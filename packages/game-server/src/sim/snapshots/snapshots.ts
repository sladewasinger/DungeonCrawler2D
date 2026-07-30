import type {
  ServerSnapshot,
  ServerStateSnapshot,
} from "@dc2d/engine";
import {
  buildPlayerSnapshotFrame,
  commitPlayerSnapshotFrame,
  type PlayerSnapshotFrame,
} from "./playerSnapshot.js";
import { shouldSendSnapshot } from "./cadence/snapshotCadence.js";
import {
  needsSnapshotBaseline,
  pruneSnapshotClients,
  snapshotClientState,
} from "./snapshotReplication.js";
import { cloneSnapshotClientState } from "../state/snapshotState.js";
import { deltaSnapshot } from "./delta.js";
import { indexSnapshotEntities, type SpatialEntityIndex } from "../core/spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "../state/state.js";

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
    miniBossArenaGates: frame.miniBossArenaGates,
    defeatedMiniBossArenas: frame.defeatedMiniBossArenas,
    inventory: slot.inventory.map((stack) => ({ ...stack })),
    hotbar: [...slot.hotbar],
    entities: frame.entities.map(({ snapshot }) => snapshot),
  };
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
  return buildPlayerSnapshotFrame({
    sim,
    slot,
    dirty: context.dirty,
    worldEvents: context.worldEvents,
    index: context.index,
  });
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
  const snapshot = next ? deltaSnapshot({ slot, frame, state: next }) : fullSnapshot(slot, frame);
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
  for (const slot of sim.players.values()) addPreparedDelivery({ sim, snapshots, slot, context });
  pruneEntityCache(sim, context.index);
  pruneSnapshotClients(sim);
  return snapshots;
}

interface PreparedDeliveryRequest {
  sim: SimState;
  snapshots: Map<string, PreparedSnapshotDelivery>;
  slot: PlayerSlot;
  context: SnapshotTickContext;
}

function addPreparedDelivery({ sim, snapshots, slot, context }: PreparedDeliveryRequest): void {
  if (!slot.connected) return discardDisconnectedSlot(sim, slot);
  const frame = snapshotFrame(sim, slot, context);
  const state = slot.snapshotMode ? snapshotClientState(sim, slot) : null;
  if (!shouldSendSnapshot(
    frame,
    state ? needsSnapshotBaseline(state) : false,
    slot.networkProfile,
  )) return;
  snapshots.set(slot.entity.id, preparedDelivery(sim, slot, frame));
}

function discardDisconnectedSlot(sim: SimState, slot: PlayerSlot): void {
  slot.outbox.length = 0;
  sim.snapshotPending.delete(slot.entity.id);
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
