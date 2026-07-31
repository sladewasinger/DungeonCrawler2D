import { TICK_RATE, WEAPON_HITBOX_TUNING } from "@dc2d/engine";

interface MeleeHitboxTiming {
  readonly activeDurationMs: number;
  /** Final tick offset strictly inside the wall-clock duration. */
  readonly lastResolutionOffsetTicks: number;
}

const TICK_DURATION_MS = 1000 / TICK_RATE;

export const MELEE_HITBOX_TIMING: MeleeHitboxTiming = Object.freeze({
  activeDurationMs: WEAPON_HITBOX_TUNING.activeDurationMs,
  lastResolutionOffsetTicks: Math.max(
    0,
    Math.ceil(WEAPON_HITBOX_TUNING.activeDurationMs / TICK_DURATION_MS) - 1,
  ),
});

export function isMeleeHitboxResolutionTick(tick: number, startedAtTick: number): boolean {
  const elapsedTicks = tick - startedAtTick;
  return elapsedTicks >= 0 &&
    elapsedTicks <= MELEE_HITBOX_TIMING.lastResolutionOffsetTicks;
}

export function isFinalMeleeHitboxResolutionTick(
  tick: number,
  startedAtTick: number,
): boolean {
  return tick - startedAtTick === MELEE_HITBOX_TIMING.lastResolutionOffsetTicks;
}
