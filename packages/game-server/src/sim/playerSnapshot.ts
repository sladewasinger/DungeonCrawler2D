import {
  AOI_RADIUS,
  xpForLevel,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import { versionedEntitySnapshot, type VersionedEntitySnapshot } from "./entitySnapshots.js";
import { type SpatialEntityIndex } from "./spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "./state.js";

/** Common per-player state collected once before full/delta wire formatting. */

export interface PlayerSnapshotFrame {
  tick: number;
  lastSeq: number;
  self: ServerSnapshot["self"];
  weapon: string | null;
  party: ServerSnapshot["party"];
  entities: VersionedEntitySnapshot[];
  left: string[];
  events: GameEvent[];
  areas: ServerSnapshot["areas"];
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
    fx: self.statuses.map((status) => status.defId),
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
    if (id === slot.entity.id || !member?.connected) continue;
    members.push({
      id,
      name: member.entity.name ?? "?",
      x: member.entity.body.x,
      y: member.entity.body.y,
      hp: member.entity.hp,
      maxHp: member.entity.maxHp,
      downed: member.downedAtTick !== null,
      level: member.stored.level ?? 1,
    });
  }
  return { id: party.id, members };
}

function areaSnapshot(
  sim: SimState,
  slot: PlayerSlot,
  dirty: ServerSnapshot["areas"],
  inAoi: (x: number, y: number) => boolean,
): ServerSnapshot["areas"] {
  if (!slot.needsFullAreas) {
    return dirty.filter((area) => area.defId === null || inAoi(area.x, area.y));
  }
  slot.needsFullAreas = false;
  return sim.areas.allTiles().filter((area) => inAoi(area.x, area.y));
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
  slot.known = visible;
  return left;
}

function snapshotEvents(
  slot: PlayerSlot,
  worldEvents: WorldEvent[],
  inAoi: (x: number, y: number) => boolean,
): GameEvent[] {
  const events = [...slot.outbox];
  slot.outbox.length = 0;
  for (const event of worldEvents) if (inAoi(event.x, event.y)) events.push(event.ev);
  return events;
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
  const visible = visibleEntities(sim, slot, index);
  return {
    tick: sim.tickCount,
    lastSeq: slot.lastSeq,
    self: toSelfSnapshot(sim, slot),
    weapon: slot.weapon,
    party: toPartySnapshot(sim, slot),
    entities: visible.entities,
    left: leavingEntities(slot, visible.ids),
    events: snapshotEvents(slot, worldEvents, inAoi),
    areas: areaSnapshot(sim, slot, dirty, inAoi),
  };
}
