/** Weapon combat feel constants, weight-tier presets, and archetype matchup helpers. */
import type { EntityKind } from "../aiSensing.js";

export type WeaponWeightTier = "light" | "medium" | "heavy";

export interface WeightFeelSpec {
  readonly weightTier: WeaponWeightTier;
  readonly hitstopSec: number;
  readonly shakePx: number;
  readonly knockbackMult: number;
}

export const WEIGHT_FEEL_PRESETS: Readonly<Record<WeaponWeightTier, WeightFeelSpec>> = {
  light: { weightTier: "light", hitstopSec: 0.028, shakePx: 0.6, knockbackMult: 0.72 },
  medium: { weightTier: "medium", hitstopSec: 0.042, shakePx: 1.4, knockbackMult: 1.0 },
  heavy: { weightTier: "heavy", hitstopSec: 0.068, shakePx: 3.1, knockbackMult: 1.45 },
};

export const MELEE_FEEL_TUNING = {
  inputBufferSec: 0.18,
  dodgeCancelWindupRatio: 0.75,
  heavyHoldMinSec: 0.24,
  heavyHoldMaxSec: 0.55,
  heavyDamageMult: 1.65,
  heavyKnockbackMult: 1.65,
  heavyStaminaExtra: 14,
  twoHandBlockMitigation: 0.45,
  twoHandBlockStaminaMult: 1.35,
  twoHandParryWindowMult: 0.8,
  riposteDamageMult: 1.75,
  parryStaggerSec: 1.45,
  parryHitstopSec: 0.075,
  parryShakePx: 2.0,
  guardBreakStaggerSec: 0.65,
  guardBreakHitstopSec: 0.055,
  guardBreakShakePx: 3.2,
  backstabHitstopSec: 0.065,
  backstabShakePx: 2.6,
  burnDurationSec: 3.2,
  burnTickIntervalSec: 0.8,
  burnTickDamage: 4,
  burnBonusMult: 1.35,
  shieldPokeDamageMult: 0.75,
  shieldPokeDurationSec: 0.24,
  webSlowDurationSec: 1.8,
  webSlowMult: 0.72,
  pickaxeArmorCrushMult: 1.4,
  pickaxeSlamAoeRadius: 0.65,
  poisonDurationSec: 6.0,
  poisonTickIntervalSec: 1.2,
  poisonTickDamage: 3,
  cocoonPoisonTickIntervalSec: 1.2,
  cocoonPoisonTickDamage: 2,
  cocoonBiteDamage: 2,
  webShotCooldownSec: 4.8,
  webShotMinRange: 2.0,
  webShotMaxRange: 6.8,
  webShotSpeed: 10.5,
  webStuckThreshold: 0.85,
  webStuckCocoonDelaySec: 1.5,
  cocoonWrapDurationSec: 2.8,
  cocoonMaxHp: 45,
  cocoonFireDps: 30,
} as const;

const SHARP_ARCHETYPES = new Set<string>(["sword", "dagger", "spear", "axe", "greatsword"]);

export function isSharpWeapon(archetype: string | undefined): boolean {
  return Boolean(archetype && SHARP_ARCHETYPES.has(archetype));
}

export function isArmorCrushTarget(kind: EntityKind | string | undefined): boolean {
  return kind === "golem" || kind === "skeleton";
}

export function isBurnVulnerable(kind: EntityKind | string | undefined): boolean {
  return kind === "spider" || kind === "slime";
}
