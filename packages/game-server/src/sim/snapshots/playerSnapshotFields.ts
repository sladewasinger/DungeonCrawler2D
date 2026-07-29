import { AOI_RADIUS, type GameEvent, type ServerSnapshot } from "@dc2d/engine";
import { versionedEntitySnapshot, type VersionedEntitySnapshot } from "./entitySnapshots.js";
import type { AoiCheck } from "./areaAoiCoverage.js";
import { socialDeliveryAllowed } from "../moderation.js";
import { newSnapshotPendingState, type SnapshotPendingState } from "../state/snapshotState.js";
import type { SpatialEntityIndex } from "../core/spatialEntities.js";
import type { PlayerSlot, SimState, WorldEvent } from "../state/state.js";

type PartyMember = NonNullable<ServerSnapshot["party"]>["members"][number];

export function toPartySnapshot(sim: SimState, slot: PlayerSlot): ServerSnapshot["party"] {
  const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;
  if (!party) return null;
  const members = [...party.members]
    .map((id) => partyMember(sim, slot, id))
    .filter((member): member is PartyMember => member !== null);
  return { id: party.id, leaderId: party.leaderId, members };
}

function partyMember(sim: SimState, slot: PlayerSlot, id: string): PartyMember | null {
  const member = sim.players.get(id);
  if (id === slot.entity.id || !member) return null;
  return {
    id,
    name: member.entity.name ?? "?",
    x: member.entity.body.x,
    y: member.entity.body.y,
    hp: member.entity.hp,
    maxHp: member.entity.maxHp,
    downed: member.downedAtTick !== null,
    ...(member.connected ? {} : { disconnected: true }),
    level: member.stored.level ?? 1,
  };
}

export function visibleEntities(request: {
  sim: SimState;
  slot: PlayerSlot;
  index: SpatialEntityIndex;
}): { entities: VersionedEntitySnapshot[]; ids: Set<string> } {
  const { sim, slot, index } = request;
  const entities = [];
  const ids = new Set<string>();
  for (const entity of index.queryCircle(slot.entity.body.x, slot.entity.body.y, AOI_RADIUS).entities) {
    if (entity.id === slot.entity.id) continue;
    ids.add(entity.id);
    entities.push(versionedEntitySnapshot(sim, entity));
  }
  return { entities, ids };
}

export function leavingEntities(slot: PlayerSlot, visible: Set<string>): string[] {
  return [...slot.known].filter((id) => !visible.has(id));
}

export function snapshotEvents(slot: PlayerSlot, pending: Pick<SnapshotPendingState, "events">): GameEvent[] {
  return [...slot.outbox, ...pending.events].filter(
    (event) => event.t !== "chat" || socialDeliveryAllowed(slot, event.from),
  );
}

export function pendingState(sim: SimState, slot: PlayerSlot): SnapshotPendingState {
  let pending = sim.snapshotPending.get(slot.entity.id);
  if (!pending) {
    pending = newSnapshotPendingState();
    sim.snapshotPending.set(slot.entity.id, pending);
  }
  return pending;
}

export function queueDeliveries(request: {
  pending: SnapshotPendingState;
  dirty: ServerSnapshot["areas"];
  worldEvents: WorldEvent[];
  inAoi: AoiCheck;
}): void {
  queueDirtyAreas(request);
  queueWorldEvents(request);
}

function queueDirtyAreas(request: { pending: SnapshotPendingState; dirty: ServerSnapshot["areas"]; inAoi: AoiCheck }): void {
  for (const area of request.dirty) {
    if (area.defId !== null && !request.inAoi(area.x, area.y)) continue;
    request.pending.areas.set(`${area.x},${area.y}`, area);
  }
}

function queueWorldEvents(request: { pending: SnapshotPendingState; worldEvents: WorldEvent[]; inAoi: AoiCheck }): void {
  for (const event of request.worldEvents) {
    if (request.inAoi(event.x, event.y)) request.pending.events.push(event.ev);
  }
}
