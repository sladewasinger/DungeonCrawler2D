/** Shared deterministic character movement speed multipliers & step helpers for server, client prediction, and sandbox. */
import { COMBAT_TUNING } from "./combatRules.js";
import { STEALTH_TUNING } from "./stealthRules.js";
import { MELEE_FEEL_TUNING, type WeaponWeightTier } from "./weapons/weaponFeelTuning.js";

export interface CharacterKinematicsInput {
  readonly dodging: boolean;
  readonly swingProgress: number;
  readonly swingWindupEnd: number;
  readonly swingWeightTier: WeaponWeightTier;
  readonly blocking: boolean;
  readonly bowCharge: number;
  readonly inWater: boolean;
  readonly inDeepWater: boolean;
  readonly stamina: number;
  readonly crouching: boolean;
  readonly webStick: number;
  readonly cocoonProgress: number;
  readonly gearAndBuffSpeedMult: number;
}

export function swingMoveSpeedMult(opts: {
  readonly swingProgress: number;
  readonly windupEnd: number;
  readonly weightTier: WeaponWeightTier;
}): number {
  if (opts.swingProgress > opts.windupEnd) return COMBAT_TUNING.movementMults.swing;
  if (opts.weightTier === "light") return 0.85;
  return opts.weightTier === "heavy" ? 0.58 : 0.72;
}

function actionMoveSpeedMult(input: CharacterKinematicsInput): number {
  const m = COMBAT_TUNING.movementMults;
  if (input.dodging) return m.dodge;
  if (input.swingProgress > 0) {
    return swingMoveSpeedMult({
      swingProgress: input.swingProgress,
      windupEnd: input.swingWindupEnd,
      weightTier: input.swingWeightTier,
    });
  }
  if (input.blocking) return m.block;
  return input.bowCharge > 0 ? m.bowDraw : 1;
}

function waterMoveSpeedMult(input: CharacterKinematicsInput): number {
  const m = COMBAT_TUNING.movementMults;
  if (input.inDeepWater) return input.stamina <= 1 ? m.exhaustedSwim : m.deepWater;
  return input.inWater ? m.shallowWater : 1;
}

function webMoveSpeedMult(webStick: number, cocoonProgress: number): number {
  if (cocoonProgress >= 0.35 || webStick >= MELEE_FEEL_TUNING.webStuckThreshold) return 0;
  return webStick > 0.05 ? 1 - webStick * 0.65 : 1;
}

/** Computes the exact shared movement speed multiplier from action, terrain, status, and gear modifiers. */
export function computeCharacterMoveMultiplier(input: CharacterKinematicsInput): number {
  const crouchMult = input.crouching ? STEALTH_TUNING.crouchSpeedMult : 1;
  const gearMult = Math.max(0.65, input.gearAndBuffSpeedMult);
  return (
    actionMoveSpeedMult(input)
    * waterMoveSpeedMult(input)
    * crouchMult
    * webMoveSpeedMult(input.webStick, input.cocoonProgress)
    * gearMult
  );
}
