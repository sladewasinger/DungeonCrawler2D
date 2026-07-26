import {
  PLAYER_MAX_STAMINA,
  xpForLevel,
  type ServerSnapshot,
} from "@dc2d/engine";
import { healthRegenerationDelaySeconds } from "./combatResources.js";
import type { PlayerSlot, SimState } from "./state.js";

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
    staminaRecoveryDelaySeconds: slot.staminaRecoveryDelaySeconds ?? 0,
    staminaExhausted: slot.staminaExhausted ?? false,
    healthRegenerationDelaySeconds: healthRegenerationDelaySeconds(sim, slot),
    fx: self.statuses.map((status) => status.defId),
    statusEffects: statusEffectSnapshots(sim, slot),
    ...(slot.downedAtTick !== null ? { downed: true } : {}),
    respawnAtTick: slot.respawnAtTick,
    xp,
    level,
    xpForNext: xpForLevel(level + 1) - xp,
    floor: sim.world.floor,
    deepestFloor: slot.stored.deepestFloor ?? 1,
  };
}
