import type {
  ServerSnapshot,
  ServerSnapshotDelta,
  ServerStateSnapshot,
} from "@dc2d/engine";
import { buildPlayerSnapshotFrame, type PlayerSnapshotFrame } from "./playerSnapshot.js";
import {
  deltaEntityEntries,
  finishDeltaSnapshot,
  needsSnapshotBaseline,
  pruneSnapshotClients,
  snapshotClientState,
  syncHotbarRevision,
  syncInventoryRevision,
} from "./snapshotReplication.js";
import { indexSnapshotEntities, type SpatialEntityIndex } from "./spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "./state.js";

/** AOI-scoped snapshots with an opt-in revision delta transport. */

interface SnapshotTickContext {
  index: SpatialEntityIndex;
  dirty: ServerSnapshot["areas"];
  worldEvents: WorldEvent[];
}

function fullSnapshot(slot: PlayerSlot, frame: PlayerSnapshotFrame): ServerSnapshot {
  return {
    type: "snapshot",
    ...frame,
    inventory: slot.inventory.map((stack) => ({ ...stack })),
    hotbar: [...slot.hotbar],
    entities: frame.entities.map(({ snapshot }) => snapshot),
  };
}

function deltaSnapshot(
  sim: SimState,
  slot: PlayerSlot,
  frame: PlayerSnapshotFrame,
): ServerSnapshotDelta {
  const state = snapshotClientState(sim, slot);
  const baseline = needsSnapshotBaseline(state);
  const inventoryChanged = syncInventoryRevision(state, slot.inventory);
  const hotbarChanged = syncHotbarRevision(state, slot.hotbar);
  return finishDeltaSnapshot(state, {
    type: "snapshotDelta",
    tick: frame.tick,
    lastSeq: frame.lastSeq,
    self: frame.self,
    inventoryRevision: state.inventoryRevision,
    ...(baseline || inventoryChanged ? { inventory: state.inventory } : {}),
    hotbarRevision: state.hotbarRevision,
    ...(baseline || hotbarChanged ? { hotbar: state.hotbar } : {}),
    weapon: frame.weapon,
    party: frame.party,
    entities: deltaEntityEntries(state, frame.entities, baseline),
    left: frame.left,
    events: frame.events,
    areas: frame.areas,
  });
}

function tickContext(sim: SimState): SnapshotTickContext {
  const context = {
    index: indexSnapshotEntities(sim),
    dirty: sim.areas.drainDirty(),
    worldEvents: sim.worldEvents,
  };
  sim.worldEvents = [];
  return context;
}

function snapshotFrame(
  sim: SimState,
  slot: PlayerSlot,
  context: SnapshotTickContext,
): PlayerSnapshotFrame {
  return buildPlayerSnapshotFrame(
    sim,
    slot,
    context.dirty,
    context.worldEvents,
    context.index,
  );
}

function pruneEntityCache(sim: SimState, index: SpatialEntityIndex): void {
  for (const id of sim.snapshotEntities.keys()) {
    if (!index.has(id)) sim.snapshotEntities.delete(id);
  }
}

/** Full snapshots for transport-free simulation tests and legacy callers. */
export function buildSnapshots(sim: SimState): Map<string, ServerSnapshot> {
  const snapshots = new Map<string, ServerSnapshot>();
  const context = tickContext(sim);
  for (const slot of sim.players.values()) {
    if (!slot.connected) {
      slot.outbox.length = 0;
      continue;
    }
    snapshots.set(slot.entity.id, fullSnapshot(slot, snapshotFrame(sim, slot, context)));
  }
  pruneEntityCache(sim, context.index);
  return snapshots;
}

/** Negotiated wire snapshots; clients without a capability remain byte-compatible. */
export function buildReplicatedSnapshots(sim: SimState): Map<string, ServerStateSnapshot> {
  const snapshots = new Map<string, ServerStateSnapshot>();
  const context = tickContext(sim);
  for (const slot of sim.players.values()) {
    if (!slot.connected) {
      slot.outbox.length = 0;
      continue;
    }
    const frame = snapshotFrame(sim, slot, context);
    const snapshot = slot.snapshotMode ? deltaSnapshot(sim, slot, frame) : fullSnapshot(slot, frame);
    snapshots.set(slot.entity.id, snapshot);
  }
  pruneEntityCache(sim, context.index);
  pruneSnapshotClients(sim);
  return snapshots;
}
