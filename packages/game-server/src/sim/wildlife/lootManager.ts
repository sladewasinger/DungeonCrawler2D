/** Authoritative persistent 27-slot POI chests and magnetic dropped enemy/wildlife loot. */
import { maxStackForItem } from "@dc2d/content";
import {
  AI_TUNING, WorldChunkCache, canInsertSlotItem, createEmptyChestSlots, insertIntoSlots,
  makeSlotItem, quickTransferChestSlot, removeFromSlot, takeAllFromChest, transferChestSlot,
  type ChunkPoi, type GroundLootSnapshot, type InventorySlot, type WorldChestSnapshot, type WorldEvent,
} from "@dc2d/engine";
import type { CombatPlayerRef } from "../combatActions.js";
import { countLitBraziersForChest, populatePoiChestSlots } from "./loot/eliteScaling.js";

interface GroundLootItem {
  readonly id: string; readonly itemId: string; count: number; readonly prefixId?: string | undefined;
  x: number; y: number; vx: number; vy: number; readonly elevation: number; ageSec: number;
  readonly pickupDelaySec: number;
  readonly manualPickup?: boolean | undefined; readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
}

interface StoredChest {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  opened: boolean;
  sealed?: boolean | undefined;
  readonly braziersTotal?: number | undefined;
  readonly slots: InventorySlot[];
}

export interface SavedChestRecord {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly opened: boolean;
  readonly sealed?: boolean | undefined;
  readonly braziersTotal?: number | undefined;
  readonly slots: readonly InventorySlot[];
}

const MAX_GROUND_LOOT_AGE_SEC = 180;
const MAX_STUCK_ARROW_AGE_SEC = 120;
const MAX_GROUND_LOOT_ITEMS = 120;

export class LootManager {
  readonly chests = new Map<string, StoredChest>();
  readonly groundLoot: GroundLootItem[] = [];
  private nextId = 1;

  constructor(private readonly cache: WorldChunkCache) {}

  registerPoiChest(poi: ChunkPoi): void {
    if (poi.hasChest === false || this.chests.has(poi.id)) return;
    const braziers = poi.brazierPositions?.length ?? 0;
    this.chests.set(poi.id, {
      id: poi.id, poiKind: poi.kind, x: poi.chestX, y: poi.chestY, elevation: poi.elevation,
      opened: false, ...(braziers > 0 ? { sealed: true, braziersTotal: braziers } : {}),
      slots: populatePoiChestSlots(this.cache, poi),
    });
  }

  unlockVaultChest(chestId: string): boolean {
    const chest = this.chests.get(chestId);
    if (!chest || !chest.sealed) return false;
    chest.sealed = false; return true;
  }

  registerCustomChest(opts: { readonly id: string; readonly x: number; readonly y: number; readonly elevation: number }): void {
    if (this.chests.has(opts.id)) return;
    this.chests.set(opts.id, { id: opts.id, poiKind: "player-chest", x: opts.x, y: opts.y, elevation: opts.elevation, opened: false, slots: createEmptyChestSlots() });
  }

  exportChests(): readonly SavedChestRecord[] {
    return Array.from(this.chests.values(), (c) => ({
      id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation,
      opened: c.opened, ...(c.sealed ? { sealed: true } : {}), ...(c.braziersTotal ? { braziersTotal: c.braziersTotal } : {}),
      slots: c.slots.map((s) => (s ? { ...s } : null)),
    }));
  }

  importChests(list: readonly SavedChestRecord[]): void {
    for (const c of list) {
      this.chests.set(c.id, {
        id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation,
        opened: c.opened, ...(c.sealed ? { sealed: true } : {}), ...(c.braziersTotal ? { braziersTotal: c.braziersTotal } : {}),
        slots: c.slots.map((s) => (s ? { ...s } : null)),
      });
    }
  }

  spawnLoot(opts: {
    readonly itemId: string; readonly count: number; readonly prefixId?: string | undefined; readonly x: number; readonly y: number;
    readonly vx: number; readonly vy: number; readonly pickupDelaySec?: number | undefined;
    readonly manualPickup?: boolean | undefined; readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
  }): void {
    while (this.groundLoot.length >= MAX_GROUND_LOOT_ITEMS) this.groundLoot.shift();
    this.groundLoot.push({
      id: `loot-${this.nextId++}`, itemId: opts.itemId, count: opts.count,
      ...(opts.prefixId ? { prefixId: opts.prefixId } : {}),
      x: opts.x, y: opts.y, vx: opts.vx, vy: opts.vy,
      elevation: this.cache.tileAt(Math.floor(opts.x), Math.floor(opts.y)).elevation, ageSec: 0,
      pickupDelaySec: opts.pickupDelaySec ?? 0.25,
      ...(opts.manualPickup ? { manualPickup: true } : {}),
      ...(opts.angle !== undefined ? { angle: opts.angle } : {}),
      ...(opts.stuck ? { stuck: true } : {}),
    });
  }

  spawnPlayerDrop(
    player: { readonly x: number; readonly y: number; readonly aimX: number; readonly aimY: number },
    item: { readonly itemId: string; readonly count: number; readonly prefixId?: string | undefined },
  ): void {
    const mag = Math.hypot(player.aimX, player.aimY);
    const dx = mag > 0.05 ? player.aimX / mag : 0;
    const dy = mag > 0.05 ? player.aimY / mag : 1;
    this.spawnLoot({
      itemId: item.itemId, count: item.count, ...(item.prefixId ? { prefixId: item.prefixId } : {}),
      x: player.x + dx * 0.7, y: player.y + dy * 0.7,
      vx: dx * 2.5, vy: dy * 2.5, pickupDelaySec: 1.8,
    });
  }

  dropFromChest(
    player: CombatPlayerRef,
    req: { readonly chestId: string; readonly slotIndex: number; readonly count?: number | undefined },
  ): boolean {
    const chest = this.findChestInReach(player, req.chestId, 1.35);
    if (!chest) return false;
    chest.opened = true;
    const removed = removeFromSlot(chest.slots, req.slotIndex, req.count);
    if (!removed) return false;
    this.spawnPlayerDrop(player, removed);
    return true;
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
    if (!chest || chest.sealed) return null;
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
    if (!chest || chest.sealed) return false;
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
    if (!chest || chest.sealed) return 0;
    chest.opened = true;
    const moved = takeAllFromChest({ chestSlots: chest.slots, invSlots: player.inventory.slots, maxStackFor: maxStackForItem });
    if (moved > 0) events.push({ kind: "loot", x: chest.x, y: chest.y, actorId: player.id, value: moved });
    return moved;
  }

  private findManualLootIdx(player: CombatPlayerRef, lootId: string | undefined): number {
    let idx = -1; let bestDist = 2.25;
    for (let i = 0; i < this.groundLoot.length; i++) {
      const g = this.groundLoot[i]!;
      const d = g.manualPickup && (!lootId || g.id === lootId) ? Math.hypot(g.x - player.x, g.y - player.y) : Infinity;
      if (d <= bestDist) { bestDist = d; idx = i; }
    }
    return idx;
  }

  pickupManualLoot(player: CombatPlayerRef, lootId: string | undefined, events: WorldEvent[]): boolean {
    const idx = this.findManualLootIdx(player, lootId);
    if (idx < 0) return false;
    const g = this.groundLoot[idx]!;
    const added = insertIntoSlots(player.inventory.slots, makeSlotItem(g.itemId, g.count, g.prefixId), maxStackForItem);
    if (added <= 0) return false;
    events.push({ kind: "loot", x: g.x, y: g.y, actorId: player.id, value: added });
    if (added >= g.count) this.groundLoot.splice(idx, 1);
    else this.groundLoot[idx] = { ...g, count: g.count - added };
    return true;
  }

  private stepLootItem(opts: { readonly g: GroundLootItem; readonly players: readonly CombatPlayerRef[]; readonly events: WorldEvent[]; readonly dt: number }): boolean {
    const { g, players, events, dt } = opts;
    g.ageSec += dt;
    const ttl = g.stuck ? MAX_STUCK_ARROW_AGE_SEC : MAX_GROUND_LOOT_AGE_SEC;
    if (g.ageSec >= ttl) return true;
    g.x += g.vx * dt; g.y += g.vy * dt;
    g.vx *= Math.max(0, 1 - dt * 6); g.vy *= Math.max(0, 1 - dt * 6);
    return !g.manualPickup && g.ageSec >= g.pickupDelaySec && this.pullOrCollectLoot({ g, players, events, dt });
  }

  step(players: readonly CombatPlayerRef[], events: WorldEvent[], dt: number): void {
    for (let i = this.groundLoot.length - 1; i >= 0; i--) {
      if (this.stepLootItem({ g: this.groundLoot[i]!, players, events, dt })) this.groundLoot.splice(i, 1);
    }
  }

  private findClosestMagnetPlayer(g: GroundLootItem, players: readonly CombatPlayerRef[]): { readonly p: CombatPlayerRef; readonly dist: number } | null {
    let p: CombatPlayerRef | null = null;
    let dist: number = AI_TUNING.lootMagnetRadiusTiles;
    for (const cand of players) {
      const d = Math.hypot(cand.x - g.x, cand.y - g.y);
      if (d < dist && canInsertSlotItem(cand.inventory.slots, { itemId: g.itemId, prefixId: g.prefixId }, maxStackForItem)) { dist = d; p = cand; }
    }
    return p ? { p, dist } : null;
  }

  private pullOrCollectLoot(opts: { readonly g: GroundLootItem; readonly players: readonly CombatPlayerRef[]; readonly events: WorldEvent[]; readonly dt: number }): boolean {
    const match = this.findClosestMagnetPlayer(opts.g, opts.players);
    if (!match) return false;
    if (match.dist <= AI_TUNING.lootPickupRadiusTiles) {
      const added = insertIntoSlots(match.p.inventory.slots, makeSlotItem(opts.g.itemId, opts.g.count, opts.g.prefixId), maxStackForItem);
      if (added <= 0) return false;
      opts.events.push({ kind: "loot", x: opts.g.x, y: opts.g.y, actorId: match.p.id, value: added });
      if (added >= opts.g.count) return true;
      opts.g.count -= added;
      return false;
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
        ...(c.sealed ? { sealed: true } : {}),
        ...(c.braziersTotal ? { braziersTotal: c.braziersTotal, braziersLit: countLitBraziersForChest(this.cache, c.id, c.braziersTotal) } : {}),
        slots: c.slots.map((s) => (s ? { ...s } : null)),
      })),
      groundLoot: this.groundLoot.map((g) => ({
        id: g.id, itemId: g.itemId, count: g.count,
        ...(g.prefixId ? { prefixId: g.prefixId } : {}),
        x: g.x, y: g.y, elevation: g.elevation, ageSec: g.ageSec,
        ...(g.manualPickup ? { manualPickup: true } : {}),
        ...(g.angle !== undefined ? { angle: g.angle } : {}),
        ...(g.stuck ? { stuck: true } : {}),
      })),
    };
  }
}
