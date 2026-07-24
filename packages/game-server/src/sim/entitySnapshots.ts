import type { Entity, EntitySnapshot } from "@dc2d/engine";
import type { SimState } from "./state.js";

/** Materializes entity payloads only when their replicated fields change. */

export interface VersionedEntitySnapshot {
  revision: number;
  snapshot: EntitySnapshot;
}

function combatantFields(
  entity: Entity,
): Pick<EntitySnapshot, "hp" | "maxHp" | "fx"> | Record<string, never> {
  if (entity.kind !== "player" && entity.kind !== "enemy") return {};
  return { hp: entity.hp, maxHp: entity.maxHp, fx: entity.statuses.map((status) => status.defId) };
}

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

function enemyFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "aimX" | "aimY"> | Record<string, never> {
  if (entity.kind !== "enemy") return {};
  const animation = sim.enemies.get(entity.id)?.animation;
  if (!animation) return {};
  const target = animation.target;
  if (!target) return { anim: animation.state };
  const dx = target.x - entity.body.x;
  const dy = target.y - entity.body.y;
  const distance = Math.hypot(dx, dy) || 1;
  return { anim: animation.state, aimX: dx / distance, aimY: dy / distance };
}

function playerFields(
  sim: SimState,
  entity: Entity,
): Pick<EntitySnapshot, "anim" | "downed" | "weapon"> | Record<string, never> {
  if (entity.kind !== "player") return {};
  const slot = sim.players.get(entity.id);
  if (!slot) return {};
  return {
    ...(sim.tickCount - slot.attackStartedAtTick <= 3 ? { anim: "attack" as const } : {}),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
    weapon: slot.weapon,
  };
}

function isAirborne(entity: Entity): boolean {
  return entity.kind === "projectile" ||
    (entity.kind === "torch" && entity.torchState === "flying") ||
    !entity.body.grounded;
}

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
    ...enemyFields(sim, entity),
    ...playerFields(sim, entity),
    ...torchFields(entity),
    ...(entity.facing ? { faceX: entity.facing.x, faceY: entity.facing.y } : {}),
    ...(isAirborne(entity) ? { air: true as const } : {}),
  };
}

function statusesMatch(entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "player" && entity.kind !== "enemy") return true;
  if (snapshot.hp !== entity.hp || snapshot.maxHp !== entity.maxHp) return false;
  if (snapshot.fx?.length !== entity.statuses.length) return false;
  return entity.statuses.every((status, index) => snapshot.fx?.[index] === status.defId);
}

function enemyMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "enemy") return true;
  const fields = enemyFields(sim, entity);
  return snapshot.anim === fields.anim &&
    snapshot.aimX === fields.aimX &&
    snapshot.aimY === fields.aimY;
}

function playerMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "player") return true;
  const fields = playerFields(sim, entity);
  return snapshot.anim === fields.anim &&
    snapshot.downed === fields.downed &&
    snapshot.weapon === fields.weapon;
}

function torchMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "torch") return true;
  return snapshot.vx === entity.vel?.x &&
    snapshot.vy === entity.vel?.y &&
    snapshot.vz === entity.vel?.z &&
    snapshot.state === entity.torchState &&
    snapshot.expiresAtTick === entity.expiresAtTick;
}

function baseMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  return snapshot.kind === entity.kind &&
    snapshot.defId === entity.defId &&
    snapshot.name === entity.name &&
    snapshot.x === entity.body.x &&
    snapshot.y === entity.body.y &&
    snapshot.z === entity.body.z;
}

function presentationMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  return snapshot.qty === (entity.kind === "item" && entity.qty > 1 ? entity.qty : undefined) &&
    snapshot.faceX === entity.facing?.x &&
    snapshot.faceY === entity.facing?.y &&
    snapshot.air === (isAirborne(entity) ? true : undefined);
}

function snapshotMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  return baseMatches(entity, snapshot) &&
    presentationMatches(entity, snapshot) &&
    statusesMatch(entity, snapshot) &&
    enemyMatches(sim, entity, snapshot) &&
    playerMatches(sim, entity, snapshot) &&
    torchMatches(entity, snapshot);
}

/** Returns the cached payload or replaces it with a new monotonic revision. */
export function versionedEntitySnapshot(
  sim: SimState,
  entity: Entity,
): VersionedEntitySnapshot {
  const cached = sim.snapshotEntities.get(entity.id);
  if (cached && snapshotMatches(sim, entity, cached.snapshot)) return cached;
  const next = {
    revision: (cached?.revision ?? 0) + 1,
    snapshot: toEntitySnapshot(sim, entity),
  };
  sim.snapshotEntities.set(entity.id, next);
  return next;
}
