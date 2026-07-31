import {
  PLAYER_MAX_STAMINA,
  REVIVE_HOLD_TICKS,
  xpForLevel,
  type ServerSnapshot,
} from "@dc2d/engine";
import { healthRegenerationDelaySeconds } from "../progression/combatResources.js";
import { adminDebugEntities } from "../admin/adminMap.js";
import { isMeleeHitboxResolutionTick } from "../actions/melee/meleeHitboxTuning.js";
import type { PlayerSlot, SimState } from "../state/state.js";

function nullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function reviveFields(sim: SimState, slot: PlayerSlot) {
  for (const attempt of sim.reviveAttempts.values()) {
    if (attempt.targetId !== slot.entity.id) continue;
    return {
      reviveProgress: Math.min(1, (sim.tickCount - attempt.startedAtTick) / REVIVE_HOLD_TICKS),
      reviverName: sim.players.get(attempt.rescuerId)?.entity.name ?? "Someone",
    };
  }
  return {};
}

function statusEffectSnapshots(sim: SimState, slot: PlayerSlot) {
  return slot.entity.statuses.map((status) => ({
    id: status.defId,
    remainingSeconds: status.remaining === null
      ? null
      : Math.max(0, status.remaining),
    durationSeconds: sim.content.statuses.get(status.defId)?.duration ?? null,
    ...(status.stacks > 1 ? { stacks: status.stacks } : {}),
  }));
}

export function toSelfSnapshot(
  sim: SimState,
  slot: PlayerSlot,
): ServerSnapshot["self"] {
  return {
    ...bodySnapshot(slot),
    ...resourceSnapshot(sim, slot),
    ...effectSnapshot(sim, slot),
    ...downedSnapshot(slot),
    ...presentationSnapshot(sim, slot),
    ...reviveFields(sim, slot),
    respawnAtTick: slot.respawnAtTick,
    ...progressionSnapshot(slot),
    ...adminSnapshot(sim, slot),
    floor: sim.world.floor,
    deepestFloor: slot.stored.deepestFloor ?? 1,
  };
}

function presentationSnapshot(
  sim: SimState,
  slot: PlayerSlot,
): Pick<ServerSnapshot["self"], "faceX" | "faceY" | "attacking"> {
  const facing = slot.entity.facing ?? { x: 1, y: 0 };
  return {
    faceX: facing.x,
    faceY: facing.y,
    attacking: isMeleeHitboxResolutionTick(sim.tickCount, slot.attackStartedAtTick),
  };
}

function adminSnapshot(
  sim: SimState,
  slot: PlayerSlot,
): Pick<ServerSnapshot["self"], "admin" | "adminDebug" | "adminDebugEntities"> | Record<string, never> {
  if (!slot.admin) return {};
  const flags = { ...slot.debugFlags };
  return {
    admin: true,
    adminDebug: flags,
    adminDebugEntities: activeAdminDebugEntities(sim, slot, flags),
  };
}

function activeAdminDebugEntities(
  sim: SimState,
  slot: PlayerSlot,
  flags: ServerSnapshot["self"]["adminDebug"],
): ServerSnapshot["self"]["adminDebugEntities"] {
  if (!flags || !Object.values(flags).some(Boolean)) return [];
  const body = slot.entity.body;
  return adminDebugEntities(sim, {
    x: body.x,
    y: body.y,
    radius: 16,
    flags,
  });
}

function bodySnapshot(slot: PlayerSlot): Pick<ServerSnapshot["self"], "x" | "y" | "z" | "zVel" | "grounded" | "coyoteTime" | "jumpBuffer" | "jumpHeld" | "kx" | "ky" | "hp" | "maxHp"> {
  const { body, hp, maxHp } = slot.entity;
  return { x: body.x, y: body.y, z: body.z, zVel: body.zVel, grounded: body.grounded, coyoteTime: body.coyoteTime, jumpBuffer: body.jumpBuffer, jumpHeld: body.jumpHeld, kx: body.kx, ky: body.ky, hp, maxHp };
}

function resourceSnapshot(sim: SimState, slot: PlayerSlot): Pick<ServerSnapshot["self"], "stamina" | "maxStamina" | "blocking" | "staminaRecoveryDelaySeconds" | "staminaExhausted" | "healthRegenerationDelaySeconds"> {
  return {
    stamina: slot.stamina ?? PLAYER_MAX_STAMINA,
    maxStamina: slot.maxStamina ?? PLAYER_MAX_STAMINA,
    blocking: slot.blocking ?? false,
    staminaRecoveryDelaySeconds: slot.staminaRecoveryDelaySeconds ?? 0,
    staminaExhausted: slot.staminaExhausted ?? false,
    healthRegenerationDelaySeconds: healthRegenerationDelaySeconds(sim, slot),
  };
}

function effectSnapshot(sim: SimState, slot: PlayerSlot): Pick<ServerSnapshot["self"], "fx" | "statusEffects" | "movementSpeed"> {
  return {
    fx: slot.entity.statuses.map((status) => status.defId),
    statusEffects: statusEffectSnapshots(sim, slot),
    movementSpeed: sim.effects.movementSpeed(slot.entity),
  };
}

function downedSnapshot(slot: PlayerSlot): Pick<ServerSnapshot["self"], "downed" | "downedUntilTick"> {
  return { ...(slot.downedAtTick === null ? {} : { downed: true }), downedUntilTick: nullable(slot.entity.downedUntil) };
}

function progressionSnapshot(slot: PlayerSlot): Pick<ServerSnapshot["self"], "xp" | "level" | "xpForNext"> {
  const level = slot.stored.level ?? 1;
  const xp = slot.stored.xp ?? 0;
  return { xp, level, xpForNext: xpForLevel(level + 1) - xp };
}
