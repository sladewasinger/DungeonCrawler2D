import {
  type GameEvent,
  type DefeatedMiniBossArenaWindow,
  type MiniBossArenaGateSnapshot,
  type SafeRoomDoorSnapshot,
  type ServerSnapshot,
} from "@dc2d/engine";
import { safeRoomDoorsForSlot } from "../core/safeRoomDoors.js";
import { miniBossArenaGatesForSlot } from "../enemies/miniBossArena/gateOverrides.js";
import { defeatedMiniBossArenaWindowForSlot } from "../enemies/miniBossArena/landmarks/defeatedLandmarks.js";
import { toSelfSnapshot } from "./selfSnapshot.js";
import {
  leavingEntities,
  pendingState,
  queueDeliveries,
  snapshotEvents,
  toPartySnapshot,
  visibleEntities,
} from "./playerSnapshotFields.js";
import { areaSnapshot, deliveryAoi } from "./areaAoiCoverage.js";
import type { AoiCenter } from "../state/state.js";
import type { PlayerSlot, SimState, WorldEvent } from "../state/state.js";
import type { SpatialEntityIndex } from "../core/spatialEntities.js";
import type { VersionedEntitySnapshot } from "./entitySnapshots.js";

/** Common per-player state collected once before full/delta wire formatting. */
export interface PlayerSnapshotFrame {
  tick: number;
  lastSeq: number;
  lastProjectedServerTick: number;
  self: ServerSnapshot["self"];
  weapon: string | null;
  party: ServerSnapshot["party"];
  entities: VersionedEntitySnapshot[];
  left: string[];
  events: GameEvent[];
  areas: ServerSnapshot["areas"];
  roomDoors: SafeRoomDoorSnapshot[];
  miniBossArenaGates: MiniBossArenaGateSnapshot[];
  defeatedMiniBossArenaWindow: DefeatedMiniBossArenaWindow;
  visibleIds: Set<string>;
  privateEventCount: number;
  pendingEventCount: number;
  pendingAreaKeys: string[];
  includesFullAreas: boolean;
  areaAoiCenter: AoiCenter;
}

export interface PlayerSnapshotBuildRequest {
  sim: SimState;
  slot: PlayerSlot;
  dirty: ServerSnapshot["areas"];
  worldEvents: WorldEvent[];
  index: SpatialEntityIndex;
}

export function buildPlayerSnapshotFrame(request: PlayerSnapshotBuildRequest): PlayerSnapshotFrame {
  const { sim, slot, dirty, worldEvents, index } = request;
  const inAoi = deliveryAoi(slot);
  const pending = pendingState(sim, slot);
  queueDeliveries({ pending, dirty, worldEvents, inAoi });
  const visible = visibleEntities({ sim, slot, index });
  const area = areaSnapshot({ sim, slot, pending });
  return snapshotFrame({ sim, slot, pending, visible, area });
}

function snapshotFrame(request: {
  sim: SimState;
  slot: PlayerSlot;
  pending: { events: GameEvent[] };
  visible: { entities: VersionedEntitySnapshot[]; ids: Set<string> };
  area: {
    areas: ServerSnapshot["areas"];
    keys: string[];
    includesFullAreas: boolean;
    coverageCenter: AoiCenter;
  };
}): PlayerSnapshotFrame {
  const { sim, slot, pending, visible, area } = request;
  return {
    ...frameIdentity(sim, slot),
    ...frameContent({ sim, slot, pending, visible, area }),
  };
}

function frameIdentity(sim: SimState, slot: PlayerSlot): Pick<
  PlayerSnapshotFrame,
  "tick" | "lastSeq" | "lastProjectedServerTick" | "self" | "weapon" | "party"
> {
  return {
    tick: sim.tickCount,
    lastSeq: slot.lastSeq,
    lastProjectedServerTick: slot.lastProjectedServerTick ?? -1,
    self: toSelfSnapshot(sim, slot),
    weapon: slot.weapon,
    party: toPartySnapshot(sim, slot),
  };
}

function frameContent(request: {
  sim: SimState;
  slot: PlayerSlot;
  pending: { events: GameEvent[] };
  visible: { entities: VersionedEntitySnapshot[]; ids: Set<string> };
  area: {
    areas: ServerSnapshot["areas"];
    keys: string[];
    includesFullAreas: boolean;
    coverageCenter: AoiCenter;
  };
}): Omit<PlayerSnapshotFrame, "tick" | "lastSeq" | "lastProjectedServerTick" | "self" | "weapon" | "party"> {
  const { sim, slot, pending, visible, area } = request;
  return {
    entities: visible.entities,
    left: leavingEntities(slot, visible.ids),
    events: snapshotEvents(slot, pending),
    areas: area.areas,
    roomDoors: safeRoomDoorsForSlot(sim, slot),
    miniBossArenaGates: miniBossArenaGatesForSlot(sim, slot),
    defeatedMiniBossArenaWindow: defeatedMiniBossArenaWindowForSlot(sim, slot),
    visibleIds: visible.ids,
    privateEventCount: slot.outbox.length,
    pendingEventCount: pending.events.length,
    pendingAreaKeys: area.keys,
    includesFullAreas: area.includesFullAreas,
    areaAoiCenter: area.coverageCenter,
  };
}

/** Commits only the mutable delivery cursors represented by a frame that will be sent. */
export function commitPlayerSnapshotFrame(
  sim: SimState,
  slot: PlayerSlot,
  frame: PlayerSnapshotFrame,
): void {
  slot.known = frame.visibleIds;
  slot.outbox.splice(0, frame.privateEventCount);
  const pending = sim.snapshotPending.get(slot.entity.id);
  pending?.events.splice(0, frame.pendingEventCount);
  for (const key of frame.pendingAreaKeys) pending?.areas.delete(key);
  if (frame.includesFullAreas) slot.needsFullAreas = false;
  slot.lastAreaAoiCenter = frame.areaAoiCenter;
  if (frame.self.finiteFloorArtifact === slot.pendingFiniteFloorArtifact) {
    delete slot.pendingFiniteFloorArtifact;
  }
}
