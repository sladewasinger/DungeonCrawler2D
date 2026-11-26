/** Extracted chest/ground-loot snapshot records and builders for LootManager. */
import type { ChunkPoi, GroundLootSnapshot, InventorySlot, WorldChestSnapshot } from "@dc2d/engine";

export interface GroundLootItem {
  readonly id: string; readonly itemId: string; count: number; readonly prefixId?: string | undefined;
  x: number; y: number; vx: number; vy: number; readonly elevation: number; ageSec: number;
  readonly pickupDelaySec: number; readonly droppedByPlayerId?: string | undefined; dropLockActive?: boolean | undefined;
  readonly manualPickup?: boolean | undefined; readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
}

export interface StoredChest {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number; readonly y: number; readonly elevation: number;
  opened: boolean; sealed?: boolean | undefined; readonly braziersTotal?: number | undefined;
  readonly slots: InventorySlot[];
}

export interface SavedChestRecord {
  readonly id: string;
  readonly poiKind: ChunkPoi["kind"] | "player-chest";
  readonly x: number; readonly y: number; readonly elevation: number;
  readonly opened: boolean; readonly sealed?: boolean | undefined; readonly braziersTotal?: number | undefined;
  readonly slots: readonly InventorySlot[];
}

export interface SpawnLootOpts {
  readonly itemId: string; readonly count: number; readonly prefixId?: string | undefined; readonly x: number; readonly y: number;
  readonly vx: number; readonly vy: number; readonly pickupDelaySec?: number | undefined;
  readonly droppedByPlayerId?: string | undefined; readonly dropLockActive?: boolean | undefined;
  readonly manualPickup?: boolean | undefined; readonly angle?: number | undefined; readonly stuck?: boolean | undefined;
}

export function buildGroundLootEntry(id: string, opts: SpawnLootOpts, elevation: number): GroundLootItem {
  return {
    id, itemId: opts.itemId, count: opts.count, x: opts.x, y: opts.y, vx: opts.vx, vy: opts.vy,
    elevation, ageSec: 0, pickupDelaySec: opts.pickupDelaySec ?? 0.25,
    ...(opts.prefixId ? { prefixId: opts.prefixId } : {}),
    ...(opts.droppedByPlayerId ? { droppedByPlayerId: opts.droppedByPlayerId } : {}),
    ...(opts.dropLockActive ? { dropLockActive: true } : {}),
    ...(opts.manualPickup ? { manualPickup: true } : {}),
    ...(opts.angle !== undefined ? { angle: opts.angle } : {}),
    ...(opts.stuck ? { stuck: true } : {}),
  };
}

export function toSavedChestRecord(c: StoredChest): SavedChestRecord {
  return {
    id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation, opened: c.opened,
    ...(c.sealed ? { sealed: true } : {}), ...(c.braziersTotal ? { braziersTotal: c.braziersTotal } : {}),
    slots: c.slots.map((s) => (s ? { ...s } : null)),
  };
}

export function toGroundLootSnapshot(g: GroundLootItem): GroundLootSnapshot {
  return {
    id: g.id, itemId: g.itemId, count: g.count, ...(g.prefixId ? { prefixId: g.prefixId } : {}),
    x: g.x, y: g.y, elevation: g.elevation, ageSec: g.ageSec,
    ...(g.manualPickup ? { manualPickup: true } : {}),
    ...(g.angle !== undefined ? { angle: g.angle } : {}),
    ...(g.stuck ? { stuck: true } : {}),
  };
}

export function toChestSnapshot(c: StoredChest, litCount: number | undefined): WorldChestSnapshot {
  return {
    id: c.id, poiKind: c.poiKind, x: c.x, y: c.y, elevation: c.elevation, opened: c.opened,
    ...(c.sealed ? { sealed: true } : {}),
    ...(c.braziersTotal ? { braziersTotal: c.braziersTotal, braziersLit: litCount ?? 0 } : {}),
    slots: c.slots.map((s) => (s ? { ...s } : null)),
  };
}