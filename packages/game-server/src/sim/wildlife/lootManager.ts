/** Authoritative persistent 27-slot POI chests and magnetic dropped enemy/wildlife loot. */
import { maxStackForItem } from "@dc2d/content";
import {
  AI_TUNING, WorldChunkCache, createEmptyChestSlots, insertIntoSlots,
  quickTransferChestSlot, takeAllFromChest, transferChestSlot,
  type ChunkPoi, type GroundLootSnapshot, type InventorySlot, type WorldChestSnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import {
  ITEM_ARROW, ITEM_BANDAGE, ITEM_COOKED_MEAT, ITEM_FLINT, ITEM_RAW_MEAT, ITEM_STONE, ITEM_TORCH,
} from "./creatureSpecs.js";

interface GroundLootItem {
  readonly id: string; readonly itemId: string; readonly count: number;
  x: number; y: number; vx: number; vy: number; readonly elevation: number; ageSec: number;
  readonly manualPickup?: boolean | undefined; readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
}

interface StoredChest {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  opened: boolean;
  readonly slots: InventorySlot[];
}

export interface SavedChestRecord {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly opened: boolean;
  readonly slots: readonly InventorySlot[];
}

const BANDIT_CAMP_POI = "bandit-camp" as const;

function populateChestSlots(poiKind: ChunkPoi["kind"]): InventorySlot[] {
  const slots = createEmptyChestSlots();
  const entries: readonly (readonly [string, number])[] = poiKind === BANDIT_CAMP_POI
    ? [[ITEM_COOKED_MEAT, 2], [ITEM_ARROW, 8], [ITEM_BANDAGE, 2], [ITEM_TORCH, 2], ["leather-boots", 1], ["sword", 1]]
    : [[ITEM_BANDAGE, 3], [ITEM_FLINT, 3], [ITEM_STONE, 4], [ITEM_RAW_MEAT, 2], ["wooden-shield", 1], [ITEM_ARROW, 10]];
  entries.forEach(([itemId, count], idx) => { slots[idx] = { itemId, count }; });
  return slots;
}

export class LootManager {
  readonly chests = new Map<string, StoredChest>();
  readonly groundLoot: GroundLootItem[] = [];
  private nextId = 1;

  constructor(private readonly cache: WorldChunkCache) {}

  registerPoiChest(poi: ChunkPoi): void {
    if (this.chests.has(poi.id)) return;
    this.chests.set(poi.id, {
      id: poi.id, poiKind: poi.kind, x: poi.chestX, y: poi.chestY, elevation: poi.elevation,
      opened: false, slots: populateChestSlots(poi.kind),
    });
  }

  registerCustomChest(opts: { readonly id: string; readonly x: number; readonly y: number; readonly elevation: number }): void {
    if (this.chests.has(opts.id)) return;
    this.chests.set(opts.id, {
      id: opts.id, poiKind: "player-chest", x: opts.x, y: opts.y, elevation: opts.elevation,
      opened: false, slots: createEmptyChestSlots(),
    });
  }

  exportChests(): readonly SavedChestRecord[] {
    return Array.from(this.chests.values(), (c) => ({
      id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation,
      opened: c.opened, slots: c.slots.map((s) => (s ? { ...s } : null)),
    }));
  }

  importChests(list: readonly SavedChestRecord[]): void {
    for (const c of list) {
      this.chests.set(c.id, {
        id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation,
        opened: c.opened, slots: c.slots.map((s) => (s ? { ...s } : null)),
      });
    }
  }

  spawnLoot(opts: {
    readonly itemId: string; readonly count: number; readonly x: number; readonly y: number;
    readonly vx: number; readonly vy: number; readonly manualPickup?: boolean | undefined;
    readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
  }): void {
    this.groundLoot.push({
      id: `loot-${this.nextId++}`, itemId: opts.itemId, count: opts.count, x: opts.x, y: opts.y, vx: opts.vx, vy: opts.vy,
      elevation: this.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation, ageSec: 0,
      ...(opts.manualPickup ? { manualPickup: true } : {}),
      ...(opts.angle !== undefined ? { angle: opts.angle } : {}),
      ...(opts.stuck ? { stuck: true } : {}),
    });
  }

  private findChestInReach(player: { readonly x: number; readonly y: number }, chestId?: string, radiusPad = 0): StoredChest | null {
    const maxR = AI_TUNING.chestInteractRadiusTiles + radiusPad;
    if (chestId) {
      const hit = this.chests.get(chestId);
      return hit && Math.hypot(hit.x - player.x, hit.y - player.y) <= maxR ? hit : null;
    }
    let best: StoredChest | null = null;
    let bestDist = maxR;
    for (const c of this.chests.values()) {
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d <= bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

  openChest(player: CombatPlayerRef, chestId: string | undefined, events: WorldEvent[]): string | null {
    const chest = this.findChestInReach(player, chestId, 0.35);
    if (!chest) return null;
    if (!chest.opened) {
      chest.opened = true;
      events.push({ kind: "chestOpen", x: chest.x, y: chest.y, actorId: player.id });
    }
    return chest.id;
  }

  transferChest(player: CombatPlayerRef, req: {
    readonly chestId: string; readonly from: "chest" | "inv"; readonly fromSlot: number;
    readonly to: "chest" | "inv"; readonly toSlot: number; readonly quick?: boolean | undefined;
  }): boolean {
    const chest = this.findChestInReach(player, req.chestId, 1.35);
    if (!chest) return false;
    chest.opened = true;
    if (req.quick) {
      return quickTransferChestSlot({
        chestSlots: chest.slots, invSlots: player.inventory.slots, from: req.from, slotIndex: req.fromSlot, maxStackFor: maxStackForItem,
      });
    }
    return transferChestSlot({
      chestSlots: chest.slots, invSlots: player.inventory.slots, from: req.from, fromSlot: req.fromSlot,
      to: req.to, toSlot: req.toSlot, maxStackFor: maxStackForItem,
    });
  }

  takeAllChest(player: CombatPlayerRef, chestId: string, events: WorldEvent[]): number {
    const chest = this.findChestInReach(player, chestId, 1.35);
    if (!chest) return 0;
    chest.opened = true;
    const moved = takeAllFromChest({ chestSlots: chest.slots, invSlots: player.inventory.slots, maxStackFor: maxStackForItem });
    if (moved > 0) events.push({ kind: "loot", x: chest.x, y: chest.y, actorId: player.id, value: moved });
    return moved;
  }

  private findManualLootIdx(player: CombatPlayerRef, lootId: string | undefined): number {
    let idx = -1;
    let bestDist = 2.25;
    for (let i = 0; i < this.groundLoot.length; i++) {
      const g = this.groundLoot[i]!;
      const valid = Boolean(g.manualPickup) && (!lootId || g.id === lootId);
      const d = valid ? Math.hypot(g.x - player.x, g.y - player.y) : Infinity;
      if (d <= bestDist) { bestDist = d; idx = i; }
    }
    return idx;
  }

  pickupManualLoot(player: CombatPlayerRef, lootId: string | undefined, events: WorldEvent[]): boolean {
    const idx = this.findManualLootIdx(player, lootId);
    if (idx < 0) return false;
    const g = this.groundLoot[idx]!;
    const added = insertIntoSlots(player.inventory.slots, { itemId: g.itemId, count: g.count }, maxStackForItem);
    if (added <= 0) return false;
    events.push({ kind: "loot", x: g.x, y: g.y, actorId: player.id, value: added });
    if (added >= g.count) this.groundLoot.splice(idx, 1);
    else this.groundLoot[idx] = { ...g, count: g.count - added };
    return true;
  }

  step(players: readonly CombatPlayerRef[], events: WorldEvent[], dt: number): void {
    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      const g = this.groundLoot[i]!;
      g.ageSec += dt;
      g.x += g.vx * dt; g.y += g.vy * dt;
      g.vx *= Math.max(0, 1 - dt * 6); g.vy *= Math.max(0, 1 - dt * 6);
      if (!g.manualPickup && g.ageSec >= 0.25 && this.pullOrCollectLoot({ g, players, events, dt })) this.groundLoot.splice(i, 1);
    }
  }

  private findClosestMagnetPlayer(g: GroundLootItem, players: readonly CombatPlayerRef[]): { readonly p: CombatPlayerRef; readonly dist: number } | null {
    let p: CombatPlayerRef | null = null;
    let dist: number = AI_TUNING.lootMagnetRadiusTiles;
    for (const cand of players) {
      const d = Math.hypot(cand.x - g.x, cand.y - g.y);
      if (d < dist) { dist = d; p = cand; }
    }
    return p ? { p, dist } : null;
  }

  private pullOrCollectLoot(opts: { readonly g: GroundLootItem; readonly players: readonly CombatPlayerRef[]; readonly events: WorldEvent[]; readonly dt: number }): boolean {
    const match = this.findClosestMagnetPlayer(opts.g, opts.players);
    if (!match) return false;
    if (match.dist <= AI_TUNING.lootPickupRadiusTiles) {
      const added = insertIntoSlots(match.p.inventory.slots, { itemId: opts.g.itemId, count: opts.g.count }, maxStackForItem);
      if (added > 0) opts.events.push({ kind: "loot", x: opts.g.x, y: opts.g.y, actorId: match.p.id, value: added });
      return added >= opts.g.count;
    }
    const pull = Math.min(match.dist, 5.4 * opts.dt);
    opts.g.x += ((match.p.x - opts.g.x) / match.dist) * pull;
    opts.g.y += ((match.p.y - opts.g.y) / match.dist) * pull;
    return false;
  }

  snapshot(): { readonly chests: WorldChestSnapshot[]; readonly groundLoot: GroundLootSnapshot[] } {
    return {
      chests: Array.from(this.chests.values(), (c) => ({
        id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation, opened: c.opened,
        slots: c.slots.map((s) => (s ? { ...s } : null)),
      })),
      groundLoot: this.groundLoot.map((g) => ({
        id: g.id, itemId: g.itemId, count: g.count, x: g.x, y: g.y, elevation: g.elevation, ageSec: g.ageSec,
        ...(g.manualPickup ? { manualPickup: true } : {}),
        ...(g.angle !== undefined ? { angle: g.angle } : {}),
        ...(g.stuck ? { stuck: true } : {}),
      })),
    };
  }
}
