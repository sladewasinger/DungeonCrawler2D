import type { Entity, EntitySnapshot } from "@dc2d/engine";
import { petSnapshotFields } from "../../pets/snapshot.js";
import type { SimState } from "../../state/state.js";
import { enemyFields, isAirborne, playerFields, velocityFields } from "./entitySnapshotFields.js";

function statusesMatch(entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "player" && entity.kind !== "enemy") return true;
  if (snapshot.hp !== entity.hp || snapshot.maxHp !== entity.maxHp) return false;
  if (snapshot.fx?.length !== entity.statuses.length) return false;
  return entity.statuses.every((status, index) => snapshot.fx?.[index] === status.defId);
}

function enemyMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "enemy") return true;
  const fields = enemyFields(sim, entity);
  return snapshot.anim === fields.anim && snapshot.aimX === fields.aimX && snapshot.aimY === fields.aimY;
}

function petMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "pet") return true;
  const fields = petSnapshotFields(sim, entity);
  return snapshot.anim === fields.anim && snapshot.petOwnerName === fields.petOwnerName;
}

function playerMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  if (entity.kind !== "player") return true;
  const fields = playerFields(sim, entity);
  return snapshot.anim === fields.anim && snapshot.downed === fields.downed &&
    snapshot.disconnected === fields.disconnected && snapshot.weapon === fields.weapon &&
    snapshot.blocking === fields.blocking && snapshot.reviveProgress === fields.reviveProgress;
}

function velocityMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  const velocity = velocityFields(sim, entity);
  return snapshot.vx === velocity.vx && snapshot.vy === velocity.vy && snapshot.vz === velocity.vz;
}

function torchMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  return entity.kind !== "torch" || (
    snapshot.state === entity.torchState && snapshot.expiresAtTick === entity.expiresAtTick
  );
}

function lootChestMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  const chest = sim.lootChests.get(entity.id);
  return [
    snapshot.lootOwnerName === chest?.victimName,
    snapshot.lootKillerId === chest?.killerId,
    snapshot.lootKillerName === chest?.killerName,
    snapshot.lootUnlockAtTick === chest?.unlockAtTick,
    snapshot.expiresAtTick === chest?.expiresAtTick,
  ].every(Boolean);
}

function baseMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  return snapshot.kind === entity.kind && snapshot.defId === entity.defId &&
    snapshot.name === entity.name && snapshot.skin === entity.skin &&
    snapshot.x === entity.body.x && snapshot.y === entity.body.y && snapshot.z === entity.body.z;
}

function presentationMatches(entity: Entity, snapshot: EntitySnapshot): boolean {
  const expectedQty = entity.kind === "item" && entity.qty > 1 ? entity.qty : undefined;
  return [
    snapshot.qty === expectedQty,
    snapshot.faceX === entity.facing?.x,
    snapshot.faceY === entity.facing?.y,
    snapshot.air === (isAirborne(entity) ? true : undefined),
  ].every(Boolean);
}

export function snapshotMatches(sim: SimState, entity: Entity, snapshot: EntitySnapshot): boolean {
  const matchers = [
    () => baseMatches(entity, snapshot),
    () => presentationMatches(entity, snapshot),
    () => statusesMatch(entity, snapshot),
    () => velocityMatches(sim, entity, snapshot),
    () => enemyMatches(sim, entity, snapshot),
    () => petMatches(sim, entity, snapshot),
    () => playerMatches(sim, entity, snapshot),
    () => torchMatches(entity, snapshot),
    () => lootChestMatches(sim, entity, snapshot),
  ];
  return matchers.every((matches) => matches());
}
