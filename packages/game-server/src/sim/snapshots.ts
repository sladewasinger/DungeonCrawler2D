import {
  AOI_RADIUS,
  type Entity,
  type EntitySnapshot,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import type { PlayerSlot, SimState, WorldEvent } from "./state.js";

/** AOI-scoped per-player snapshots: entities, events, and area deltas. */

/** Extra fields layered onto a base entity snapshot for combatant kinds and animation state. */
function combatantFields(
  entity: Entity,
): Pick<EntitySnapshot, "hp" | "maxHp" | "fx"> | Record<string, never> {
  if (entity.kind !== "player" && entity.kind !== "enemy") return {};
  return { hp: entity.hp, maxHp: entity.maxHp, fx: entity.statuses.map((s) => s.defId) };
}

/** Torch flight velocity + flying/placed state + burnout tick. */
function torchFields(
  entity: Entity,
): Pick<EntitySnapshot, "vx" | "vy" | "vz" | "state" | "expiresAtTick"> | Record<string, never> {
  if (entity.kind !== "torch") return {};
  return {
    ...(entity.vel ? { vx: entity.vel.x, vy: entity.vel.y, vz: entity.vel.z } : {}),
    ...(entity.torchState ? { state: entity.torchState } : {}),
    ...(entity.expiresAtTick !== undefined ? { expiresAtTick: entity.expiresAtTick } : {}),
  };
}

/** Enemy anim + aim vector (unit vector toward the enemy's current target). */
function enemyAnimFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "aimX" | "aimY"> | Record<string, never> {
  if (entity.kind !== "enemy") return {};
  // kind === "enemy" guarantees an enemy slot exists.
  const animation = sim.enemies.get(entity.id)!.animation;
  const target = animation.target;
  if (!target) return { anim: animation.state };
  const dx = target.x - entity.body.x;
  const dy = target.y - entity.body.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { anim: animation.state, aimX: dx / distance, aimY: dy / distance };
}

/** Player-only fields: brief attack replication and downed flag. */
function playerFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "downed"> | Record<string, never> {
  if (entity.kind !== "player") return {};
  const slot = sim.players.get(entity.id);
  if (!slot) return {};
  return {
    ...(sim.tickCount - slot.attackStartedAtTick <= 3 ? { anim: "attack" as const } : {}),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
  };
}

/** Build one entity's AOI snapshot payload. */
function toEntitySnapshot(sim: SimState, entity: Entity): EntitySnapshot {
  return {
    id: entity.id,
    kind: entity.kind,
    ...(entity.defId !== undefined ? { defId: entity.defId } : {}),
    ...(entity.name !== undefined ? { name: entity.name } : {}),
    x: entity.body.x,
    y: entity.body.y,
    z: entity.body.z,
    ...combatantFields(entity),
    ...(entity.kind === "item" && entity.qty > 1 ? { qty: entity.qty } : {}),
    ...enemyAnimFields(sim, entity),
    ...playerFields(sim, entity),
    ...torchFields(entity),
    ...(entity.facing ? { faceX: entity.facing.x, faceY: entity.facing.y } : {}),
    // Projectiles never touch body.grounded; everyone else is
    // airborne only mid-jump/mid-fall. A flying torch is the same deal
    // (placed torches sit grounded, no override needed).
    ...(entity.kind === "projectile" ||
    (entity.kind === "torch" && entity.torchState === "flying") ||
    !entity.body.grounded
      ? { air: true as const }
      : {}),
  };
}

/** Gather every entity in `self`'s AOI, marking which ids are newly/still visible. */
function gatherVisible(
  sim: SimState,
  self: Entity,
  inAoi: (x: number, y: number) => boolean,
): { entities: EntitySnapshot[]; visible: Set<string> } {
  const entities: EntitySnapshot[] = [];
  const visible = new Set<string>();
  const consider = (entity: Entity) => {
    if (entity.id === self.id) return;
    if (!inAoi(entity.body.x, entity.body.y)) return;
    visible.add(entity.id);
    entities.push(toEntitySnapshot(sim, entity));
  };
  for (const other of sim.players.values()) if (other.entity.hp >= 0) consider(other.entity);
  for (const enemy of sim.enemies.values()) consider(enemy.entity);
  for (const item of sim.items.values()) consider(item);
  for (const projectile of sim.projectiles.values()) consider(projectile);
  for (const torch of sim.torches.values()) consider(torch);
  return { entities, visible };
}

/** Build the `self` block: body state + vitals, from the player's own entity. */
function toSelfSnapshot(slot: PlayerSlot): ServerSnapshot["self"] {
  const self = slot.entity;
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
    fx: self.statuses.map((s) => s.defId),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
  };
}

/** Build the `party` block: other members' ids/names/positions, or null when unpartied. */
function toPartySnapshot(sim: SimState, slot: PlayerSlot): ServerSnapshot["party"] {
  const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;
  if (!party) return null;
  return {
    id: party.id,
    members: [...party.members]
      .filter((m) => m !== slot.entity.id)
      .map((m) => {
        // Member ids come from the party's own member set, always a live player slot.
        const member = sim.players.get(m)!;
        return {
          id: m,
          name: member.entity.name ?? "?",
          x: member.entity.body.x,
          y: member.entity.body.y,
          hp: member.entity.hp,
          maxHp: member.entity.maxHp,
          downed: member.downedAtTick !== null,
        };
      }),
  };
}

/** Area deltas in AOI: dirty tiles, or the full known set right after join/teleport. */
function toAreaSnapshot(
  sim: SimState,
  slot: PlayerSlot,
  areaDirty: Array<{ x: number; y: number; defId: string | null }>,
  inAoi: (x: number, y: number) => boolean,
): Array<{ x: number; y: number; defId: string | null }> {
  if (!slot.needsFullAreas) return areaDirty.filter((a) => inAoi(a.x, a.y));
  slot.needsFullAreas = false;
  return sim.areas.allTiles().filter((a) => inAoi(a.x, a.y));
}

/** Build one player's full ServerSnapshot: self, entities, events, area deltas. */
function buildPlayerSnapshot(
  sim: SimState,
  slot: PlayerSlot,
  areaDirty: Array<{ x: number; y: number; defId: string | null }>,
  worldEvents: WorldEvent[],
): ServerSnapshot {
  const self = slot.entity;
  const inAoi = (x: number, y: number) =>
    (x - self.body.x) ** 2 + (y - self.body.y) ** 2 <= AOI_RADIUS * AOI_RADIUS;

  const { entities, visible } = gatherVisible(sim, self, inAoi);

  const left: string[] = [];
  for (const id of slot.known) if (!visible.has(id)) left.push(id);
  slot.known = visible;

  const events: GameEvent[] = [...slot.outbox];
  slot.outbox.length = 0;
  for (const we of worldEvents) if (inAoi(we.x, we.y)) events.push(we.ev);

  return {
    type: "snapshot",
    tick: sim.tickCount,
    lastSeq: slot.lastSeq,
    self: toSelfSnapshot(slot),
    inventory: slot.inventory.map((s) => ({ ...s })),
    hotbar: [...slot.hotbar],
    weapon: slot.weapon,
    party: toPartySnapshot(sim, slot),
    entities,
    left,
    events,
    areas: toAreaSnapshot(sim, slot, areaDirty, inAoi),
  };
}

/** Build AOI-scoped snapshots for every connected player. */
export function buildSnapshots(sim: SimState): Map<string, ServerSnapshot> {
  const snapshots = new Map<string, ServerSnapshot>();
  const areaDirty = sim.areas.drainDirty();
  const worldEvents = sim.worldEvents;
  sim.worldEvents = [];

  for (const slot of sim.players.values()) {
    if (!slot.connected) {
      slot.outbox.length = 0;
      continue;
    }
    snapshots.set(slot.entity.id, buildPlayerSnapshot(sim, slot, areaDirty, worldEvents));
  }
  return snapshots;
}
