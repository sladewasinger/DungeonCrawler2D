import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Persistent per-player data keyed by anonymous clientId: personal
 * stretch-room slot and stash contents. File-backed JSON with
 * debounced writes, path set by the STORE_FILE env var per the deploy
 * contract. Pass file=null for memory-only (tests).
 */

export interface StashEntry {
  item: string;
  qty: number;
}

export interface StoredPlayer {
  slot: number;
  name: string;
  stash: StashEntry[];
  /** Mutual-fistbump contacts, by display name (Epic 7.10). No cap. */
  contacts: string[];
  /** Epic 11 core (character levels), pulled forward into Epic 7.13 —
   * ASSUMPTION #90 (docs/ASSUMPTIONS.md). Optional in the TYPE (not just
   * the save file) so the many hand-built PlayerSlot/StoredPlayer test
   * fixtures across sim/ that predate this field keep compiling unchanged;
   * every reader treats a missing value as xp 0 / level 1, and `get()`
   * below always populates concrete values for records it creates. */
  xp?: number;
  level?: number;
  /** Epic 7.14 (The Descent) — deepest floor this clientId has ever
   * reached. Optional in the TYPE for the same reason xp/level are: many
   * pre-existing hand-built fixtures across sim/ predate this field;
   * every reader treats a missing value as 1, and `get()` always
   * populates a concrete value for records it creates. */
  deepestFloor?: number;
}

export const STASH_CAPACITY = 24;

export class PlayerStore {
  private readonly data = new Map<string, StoredPlayer>();
  private nextSlot = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly file: string | null) {
    if (!file) return;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as {
        nextSlot: number;
        players: Record<string, StoredPlayer>;
      };
      this.nextSlot = raw.nextSlot;
      // contacts (Epic 7.10), xp/level (Epic 11 core, ASSUMPTION #90), and
      // deepestFloor (Epic 7.14) are all additive — records saved before
      // any of them shipped lack them.
      for (const [id, p] of Object.entries(raw.players)) {
        this.data.set(id, {
          ...p,
          contacts: p.contacts ?? [],
          xp: p.xp ?? 0,
          level: p.level ?? 1,
          deepestFloor: p.deepestFloor ?? 1,
        });
      }
    } catch {
      // first boot — empty store
    }
  }

  /** True if this clientId already has a durable record — i.e. this is
   * not their first-ever join (server restarts don't reset this, unlike
   * the in-memory per-connection sim state). */
  has(clientId: string): boolean {
    return this.data.has(clientId);
  }

  /** Fetch (or create) the durable record for a clientId. */
  get(clientId: string, name: string): StoredPlayer {
    let player = this.data.get(clientId);
    if (!player) {
      player = { slot: this.nextSlot++, name, stash: [], contacts: [], xp: 0, level: 1, deepestFloor: 1 };
      this.data.set(clientId, player);
      this.scheduleSave();
    } else if (player.name !== name) {
      player.name = name;
      this.scheduleSave();
    }
    return player;
  }

  /** Merge items into a stash (stacking), respecting capacity. */
  stashAdd(player: StoredPlayer, item: string, qty: number, maxStack: number): boolean {
    let remaining = qty;
    for (const entry of player.stash) {
      if (entry.item !== item || entry.qty >= maxStack) continue;
      const take = Math.min(maxStack - entry.qty, remaining);
      entry.qty += take;
      remaining -= take;
      if (remaining === 0) break;
    }
    while (remaining > 0) {
      if (player.stash.length >= STASH_CAPACITY) {
        this.scheduleSave();
        return false;
      }
      const take = Math.min(maxStack, remaining);
      player.stash.push({ item, qty: take });
      remaining -= take;
    }
    this.scheduleSave();
    return true;
  }

  stashTake(player: StoredPlayer, index: number): StashEntry | null {
    const entry = player.stash[index];
    if (!entry) return null;
    player.stash.splice(index, 1);
    this.scheduleSave();
    return entry;
  }

  /** Idempotent, case-insensitive: mutual fistbump adds each side's name to the other's list. */
  addContact(player: StoredPlayer, name: string): void {
    if (player.contacts.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    player.contacts.push(name);
    this.scheduleSave();
  }

  /** Epic 7.14 (The Descent): bump the durable deepest-floor watermark;
   * never decreases (arriving back at floor 1 doesn't erase a floor 4 run). */
  recordDeepestFloor(player: StoredPlayer, floor: number): void {
    if (floor <= (player.deepestFloor ?? 1)) return;
    player.deepestFloor = floor;
    this.scheduleSave();
  }

  /**
   * Add XP and recompute level via the caller-supplied curve (kept out of
   * this persistence-only file — see sim/xp.ts's `levelForXp`). Death never
   * calls this in reverse: XP is never removed (ASSUMPTION #90). No level
   * cap, so `leveledUp` can fire on every call in principle.
   */
  addXp(
    player: StoredPlayer,
    amount: number,
    levelForXp: (xp: number) => number,
  ): { level: number; leveledUp: boolean } {
    const beforeLevel = player.level ?? 1;
    const xp = (player.xp ?? 0) + amount;
    const level = levelForXp(xp);
    player.xp = xp;
    player.level = level;
    this.scheduleSave();
    return { level, leveledUp: level > beforeLevel };
  }

  scheduleSave(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 2000);
  }

  flush(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(
        this.file,
        JSON.stringify({ nextSlot: this.nextSlot, players: Object.fromEntries(this.data) }),
      );
    } catch (err) {
      console.error("[store] save failed:", err);
    }
  }
}
