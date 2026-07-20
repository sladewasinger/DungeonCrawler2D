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
        players: Record<string, Omit<StoredPlayer, "contacts"> & { contacts?: string[] }>;
      };
      this.nextSlot = raw.nextSlot;
      // contacts is new (Epic 7.10) — records saved before it lack the field.
      for (const [id, p] of Object.entries(raw.players)) {
        this.data.set(id, { ...p, contacts: p.contacts ?? [] });
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
      player = { slot: this.nextSlot++, name, stash: [], contacts: [] };
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
