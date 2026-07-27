import {
  PLAYER_MAX_STAMINA,
  REVIVE_HOLD_TICKS,
  xpForLevel,
  type ServerSnapshot,
} from "@dc2d/engine";
import { healthRegenerationDelaySeconds } from "./combatResources.js";
import type { PlayerSlot, SimState } from "./state.js";

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
    ...reviveFields(sim, slot),
    respawnAtTick: slot.respawnAtTick,
    ...progressionSnapshot(slot),
    floor: sim.world.floor,
    deepestFloor: slot.stored.deepestFloor ?? 1,
  };
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

function effectSnapshot(sim: SimState, slot: PlayerSlot): Pick<ServerSnapshot["self"], "fx" | "statusEffects"> {
  return { fx: slot.entity.statuses.map((status) => status.defId), statusEffects: statusEffectSnapshots(sim, slot) };
}

function downedSnapshot(slot: PlayerSlot): Pick<ServerSnapshot["self"], "downed" | "downedUntilTick"> {
  return { ...(slot.downedAtTick === null ? {} : { downed: true }), downedUntilTick: nullable(slot.entity.downedUntil) };
}

function progressionSnapshot(slot: PlayerSlot): Pick<ServerSnapshot["self"], "xp" | "level" | "xpForNext"> {
  const level = slot.stored.level ?? 1;
  const xp = slot.stored.xp ?? 0;
  return { xp, level, xpForNext: xpForLevel(level + 1) - xp };
}
