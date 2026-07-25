import {
  AOI_RADIUS,
  PLAYER_MAX_STAMINA,
  xpForLevel,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import { versionedEntitySnapshot, type VersionedEntitySnapshot } from "./entitySnapshots.js";
import { socialDeliveryAllowed } from "./moderation.js";
import { newSnapshotPendingState, type SnapshotPendingState } from "./snapshotState.js";
import { type SpatialEntityIndex } from "./spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "./state.js";

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
  visibleIds: Set<string>;
  privateEventCount: number;
  pendingEventCount: number;
  pendingAreaKeys: string[];
  includesFullAreas: boolean;
}

function toSelfSnapshot(sim: SimState, slot: PlayerSlot): ServerSnapshot["self"] {
  const self = slot.entity;
  const level = slot.stored.level ?? 1;
  const xp = slot.stored.xp ?? 0;
  return {
    x: self.body.x,
    y: self.body.y,
    z: self.body.z,
    zVel: self.body.zVel,
    grounded: self.body.grounded,
    coyoteTime: self.body.coyoteTime,
    jumpBuffer: self.body.jumpBuffer,
    jumpHeld: self.body.jumpHeld,
    kx: self.body.kx,
    ky: self.body.ky,
    hp: self.hp,
    maxHp: self.maxHp,
    stamina: slot.stamina ?? PLAYER_MAX_STAMINA,
    maxStamina: slot.maxStamina ?? PLAYER_MAX_STAMINA,
    blocking: slot.blocking ?? false,
    fx: self.statuses.map((status) => status.defId),
    statusEffects: self.statuses.map((status) => ({
      id: status.defId,
      remainingSeconds: status.remaining === null
        ? null
        : Math.max(0, status.remaining),
      durationSeconds: sim.content.statuses.get(status.defId)?.duration ?? null,
    })),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
    xp,
    level,
    xpForNext: xpForLevel(level + 1) - xp,
    floor: sim.world.floor,
    deepestFloor: slot.stored.deepestFloor ?? 1,
  };
}

function toPartySnapshot(sim: SimState, slot: PlayerSlot): ServerSnapshot["party"] {
  const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;
  if (!party) return null;
  const members = [];
  for (const id of party.members) {
    const member = sim.players.get(id);
    if (id === slot.entity.id || !member) continue;
    members.push({
      id,
      name: member.entity.name ?? "?",
      x: member.entity.body.x,
      y: member.entity.body.y,
      hp: member.entity.hp,
      maxHp: member.entity.maxHp,
      downed: member.downedAtTick !== null,
      ...(member.connected ? {} : { disconnected: true }),
      level: member.stored.level ?? 1,
    });
  }
  return { id: party.id, leaderId: party.leaderId, members };
}

function areaSnapshot(
  sim: SimState,
  slot: PlayerSlot,
  pending: SnapshotPendingState,
  inAoi: (x: number, y: number) => boolean,
): { areas: ServerSnapshot["areas"]; keys: string[]; includesFullAreas: boolean } {
  if (!slot.needsFullAreas) {
    return {
      areas: [...pending.areas.values()],
      keys: [...pending.areas.keys()],
      includesFullAreas: false,
    };
  }
  return {
    areas: sim.areas.allTiles().filter((area) => inAoi(area.x, area.y)),
    keys: [...pending.areas.keys()],
    includesFullAreas: true,
  };
}

function visibleEntities(
  sim: SimState,
  slot: PlayerSlot,
  index: SpatialEntityIndex,
): { entities: VersionedEntitySnapshot[]; ids: Set<string> } {
  const entities = [];
  const ids = new Set<string>();
  const self = slot.entity;
  for (const entity of index.queryCircle(self.body.x, self.body.y, AOI_RADIUS).entities) {
    if (entity.id === self.id) continue;
    ids.add(entity.id);
    entities.push(versionedEntitySnapshot(sim, entity));
  }
  return { entities, ids };
}

function leavingEntities(slot: PlayerSlot, visible: Set<string>): string[] {
  const left = [];
  for (const id of slot.known) if (!visible.has(id)) left.push(id);
  return left;
}

function snapshotEvents(
  slot: PlayerSlot,
  pending: SnapshotPendingState,
): GameEvent[] {
  return [...slot.outbox, ...pending.events].filter(
    (event) => event.t !== "chat" || socialDeliveryAllowed(slot, event.from),
  );
}

function pendingState(sim: SimState, slot: PlayerSlot): SnapshotPendingState {
  let pending = sim.snapshotPending.get(slot.entity.id);
  if (!pending) {
    pending = newSnapshotPendingState();
    sim.snapshotPending.set(slot.entity.id, pending);
  }
  return pending;
}

function queueDeliveries(
  pending: SnapshotPendingState,
  dirty: ServerSnapshot["areas"],
  worldEvents: WorldEvent[],
  inAoi: (x: number, y: number) => boolean,
): void {
  for (const area of dirty) {
    if (area.defId !== null && !inAoi(area.x, area.y)) continue;
    pending.areas.set(`${area.x},${area.y}`, area);
  }
  for (const event of worldEvents) {
    if (inAoi(event.x, event.y)) pending.events.push(event.ev);
  }
}

export function buildPlayerSnapshotFrame(
  sim: SimState,
  slot: PlayerSlot,
  dirty: ServerSnapshot["areas"],
  worldEvents: WorldEvent[],
  index: SpatialEntityIndex,
): PlayerSnapshotFrame {
  const self = slot.entity;
  const inAoi = (x: number, y: number) =>
    (x - self.body.x) ** 2 + (y - self.body.y) ** 2 <= AOI_RADIUS * AOI_RADIUS;
  const pending = pendingState(sim, slot);
  queueDeliveries(pending, dirty, worldEvents, inAoi);
  const visible = visibleEntities(sim, slot, index);
  const area = areaSnapshot(sim, slot, pending, inAoi);
  return {
    tick: sim.tickCount,
    lastSeq: slot.lastSeq,
    lastProjectedServerTick: slot.lastProjectedServerTick ?? -1,
    self: toSelfSnapshot(sim, slot),
    weapon: slot.weapon,
    party: toPartySnapshot(sim, slot),
    entities: visible.entities,
    left: leavingEntities(slot, visible.ids),
    events: snapshotEvents(slot, pending),
    areas: area.areas,
    visibleIds: visible.ids,
    privateEventCount: slot.outbox.length,
    pendingEventCount: pending.events.length,
    pendingAreaKeys: area.keys,
    includesFullAreas: area.includesFullAreas,
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
}
