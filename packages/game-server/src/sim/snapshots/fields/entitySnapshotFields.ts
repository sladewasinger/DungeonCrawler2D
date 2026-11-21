import type { Entity, EntitySnapshot } from "@dc2d/engine";
import { isMeleeHitboxResolutionTick } from "../../actions/melee/meleeHitboxTuning.js";
import { petSnapshotFields } from "../../pets/snapshot.js";
import { reviveSnapshotFields } from "../../players/playerSnapshotFields.js";
import type { PlayerSlot, SimState } from "../../state/state.js";

type SnapshotFields = Record<string, never> | Partial<EntitySnapshot>;

function combatantFields(entity: Entity): SnapshotFields {
  if (entity.kind !== "player" && entity.kind !== "enemy") return {};
  return { hp: entity.hp, maxHp: entity.maxHp, fx: entity.statuses.map((status) => status.defId) };
}

export function velocityFields(sim: SimState, entity: Entity): SnapshotFields {
  if ((entity.kind === "projectile" || entity.kind === "torch") && entity.vel) {
    return { vx: entity.vel.x, vy: entity.vel.y, vz: entity.vel.z };
  }
  const motion = sim.replicationMotion.get(entity.id);
  return motion ? {
    vx: motion.x,
    vy: motion.y,
    ...(!entity.body.grounded ? { vz: entity.body.zVel } : {}),
  } : {};
}

function torchFields(entity: Entity): SnapshotFields {
  if (entity.kind !== "torch") return {};
  return {
    ...(entity.torchState ? { state: entity.torchState } : {}),
    ...(entity.expiresAtTick !== undefined ? { expiresAtTick: entity.expiresAtTick } : {}),
  };
}

function lootChestFields(sim: SimState, entity: Entity): SnapshotFields {
  const chest = sim.lootChests.get(entity.id);
  if (!chest) return {};
  return {
    lootOwnerName: chest.victimName,
    ...(chest.killerId ? { lootKillerId: chest.killerId } : {}),
    ...(chest.killerName ? { lootKillerName: chest.killerName } : {}),
    lootUnlockAtTick: chest.unlockAtTick,
    expiresAtTick: chest.expiresAtTick,
  };
}

export function enemyFields(sim: SimState, entity: Entity): SnapshotFields {
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

export function playerFields(sim: SimState, entity: Entity): SnapshotFields {
  if (entity.kind !== "player") return {};
  const slot = sim.players.get(entity.id);
  if (!slot) return {};
  return {
    ...playerAnimationFields(sim, slot),
    ...playerStateFields(slot),
    weapon: slot.weapon,
    ...(slot.blocking ? { blocking: true } : {}),
    ...reviveSnapshotFields(sim, entity.id),
  };
}

function playerAnimationFields(sim: SimState, slot: PlayerSlot): SnapshotFields {
  return isMeleeHitboxResolutionTick(sim.tickCount, slot.attackStartedAtTick)
    ? { anim: "attack" }
    : {};
}

function playerStateFields(slot: PlayerSlot): SnapshotFields {
  return {
    ...(slot.admin ? { admin: true } : {}),
    ...(slot.noclip ? { noclip: true } : {}),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
    ...(slot.connected ? {} : { disconnected: true }),
    ...(slot.blocking ? { blocking: true } : {}),
  };
}

export function isAirborne(entity: Entity): boolean {
  return entity.kind === "projectile" ||
    (entity.kind === "torch" && entity.torchState === "flying") ||
    !entity.body.grounded;
}

export function toEntitySnapshot(sim: SimState, entity: Entity): EntitySnapshot {
  return {
    id: entity.id,
    kind: entity.kind,
    ...identityFields(entity),
    x: entity.body.x,
    y: entity.body.y,
    z: entity.body.z,
    ...combatantFields(entity),
    ...itemQuantityFields(entity),
    ...enemyFields(sim, entity),
    ...petSnapshotFields(sim, entity),
    ...playerFields(sim, entity),
    ...velocityFields(sim, entity),
    ...torchFields(entity),
    ...lootChestFields(sim, entity),
    ...facingFields(entity),
    ...airborneFields(entity),
  };
}

function identityFields(entity: Entity): SnapshotFields {
  return {
    ...(entity.defId !== undefined ? { defId: entity.defId } : {}),
    ...(entity.name !== undefined ? { name: entity.name } : {}),
    ...(entity.skin !== undefined ? { skin: entity.skin } : {}),
  };
}

function itemQuantityFields(entity: Entity): SnapshotFields {
  return entity.kind === "item" && entity.qty > 1 ? { qty: entity.qty } : {};
}

function facingFields(entity: Entity): SnapshotFields {
  return entity.facing ? { faceX: entity.facing.x, faceY: entity.facing.y } : {};
}

function airborneFields(entity: Entity): SnapshotFields {
  return isAirborne(entity) ? { air: true } : {};
}
