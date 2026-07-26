import type {
  ServerSnapshot,
  ServerSnapshotDelta,
  ServerStateSnapshot,
} from "@dc2d/engine";
import {
  buildPlayerSnapshotFrame,
  commitPlayerSnapshotFrame,
  type PlayerSnapshotFrame,
} from "./playerSnapshot.js";
import { shouldSendSnapshot } from "./snapshotCadence.js";
import {
  deltaEntityEntries,
  finishDeltaSnapshot,
  needsSnapshotBaseline,
  pruneSnapshotClients,
  snapshotClientState,
  syncHotbarRevision,
  syncInventoryRevision,
} from "./snapshotReplication.js";
import { cloneSnapshotClientState, type SnapshotClientState } from "./snapshotState.js";
import { indexSnapshotEntities, type SpatialEntityIndex } from "./spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "./state.js";

/** AOI-scoped snapshots with an opt-in revision delta transport. */

interface SnapshotTickContext {
  index: SpatialEntityIndex;
  dirty: ServerSnapshot["areas"];
  worldEvents: WorldEvent[];
}

export interface PreparedSnapshotDelivery {
  snapshot: ServerStateSnapshot;
  commit(): void;
}

function fullSnapshot(slot: PlayerSlot, frame: PlayerSnapshotFrame): ServerSnapshot {
  return {
    type: "snapshot",
    tick: frame.tick,
    lastSeq: frame.lastSeq,
    lastProjectedServerTick: frame.lastProjectedServerTick,
    self: frame.self,
    weapon: frame.weapon,
    party: frame.party,
    left: frame.left,
    events: frame.events,
    areas: frame.areas,
    roomDoors: frame.roomDoors,
    inventory: slot.inventory.map((stack) => ({ ...stack })),
    hotbar: [...slot.hotbar],
    entities: frame.entities.map(({ snapshot }) => snapshot),
  };
}

function deltaSnapshot(
  slot: PlayerSlot,
  frame: PlayerSnapshotFrame,
  state: SnapshotClientState,
): ServerSnapshotDelta {
  const baseline = needsSnapshotBaseline(state);
  const inventoryChanged = syncInventoryRevision(state, slot.inventory);
  const hotbarChanged = syncHotbarRevision(state, slot.hotbar);
  return finishDeltaSnapshot(state, {
    type: "snapshotDelta",
    tick: frame.tick,
    lastSeq: frame.lastSeq,
    lastProjectedServerTick: frame.lastProjectedServerTick,
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
    roomDoors: frame.roomDoors,
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
    if (index.has(id)) continue;
    sim.snapshotEntities.delete(id);
    sim.replicationMotion.delete(id);
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
    const frame = snapshotFrame(sim, slot, context);
    snapshots.set(slot.entity.id, fullSnapshot(slot, frame));
    commitPlayerSnapshotFrame(sim, slot, frame);
  }
  pruneEntityCache(sim, context.index);
  return snapshots;
}

function preparedDelivery(
  sim: SimState,
  slot: PlayerSlot,
  frame: PlayerSnapshotFrame,
): PreparedSnapshotDelivery {
  const current = slot.snapshotMode ? snapshotClientState(sim, slot) : null;
  const next = current ? cloneSnapshotClientState(current) : null;
  const snapshot = next ? deltaSnapshot(slot, frame, next) : fullSnapshot(slot, frame);
  let committed = false;
  return {
    snapshot,
    commit() {
      if (committed) return;
      committed = true;
      if (next) sim.snapshotClients.set(slot.entity.id, next);
      commitPlayerSnapshotFrame(sim, slot, frame);
    },
  };
}

/** Builds delivery transactions whose cursors advance only after transport acceptance. */
export function buildPreparedReplicatedSnapshots(
  sim: SimState,
): Map<string, PreparedSnapshotDelivery> {
  const snapshots = new Map<string, PreparedSnapshotDelivery>();
  const context = tickContext(sim);
  for (const slot of sim.players.values()) {
    if (!slot.connected) {
      slot.outbox.length = 0;
      sim.snapshotPending.delete(slot.entity.id);
      continue;
    }
    const frame = snapshotFrame(sim, slot, context);
    const state = slot.snapshotMode ? snapshotClientState(sim, slot) : null;
    if (!shouldSendSnapshot(frame, state ? needsSnapshotBaseline(state) : false)) continue;
    snapshots.set(slot.entity.id, preparedDelivery(sim, slot, frame));
  }
  pruneEntityCache(sim, context.index);
  pruneSnapshotClients(sim);
  return snapshots;
}

/** Transport-free compatibility path: every prepared delivery is accepted immediately. */
export function buildReplicatedSnapshots(sim: SimState): Map<string, ServerStateSnapshot> {
  const snapshots = new Map<string, ServerStateSnapshot>();
  for (const [id, delivery] of buildPreparedReplicatedSnapshots(sim)) {
    snapshots.set(id, delivery.snapshot);
    delivery.commit();
  }
  return snapshots;
}
