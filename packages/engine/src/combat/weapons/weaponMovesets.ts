/** Extensible per-weapon melee moveset registry, 3-phase timing, weight feel, and harvest tool hooks. */
import { getItemDef } from "@dc2d/content";
import {
  WEAPON_ARCHETYPES,
  type AttackMotionKind, type GoreStyle, type HarvestToolKind, type WeaponArchetype,
} from "@dc2d/contracts";
import { WEIGHT_FEEL_PRESETS, type WeaponWeightTier } from "./weaponFeelTuning.js";

export { WEAPON_ARCHETYPES };
export type { AttackMotionKind, HarvestToolKind, WeaponArchetype };

const GORE_CHUNK_SPRAY: GoreStyle = "chunk-spray";
const LIGHT = WEIGHT_FEEL_PRESETS.light;
const MED = WEIGHT_FEEL_PRESETS.medium;
const HEAVY = WEIGHT_FEEL_PRESETS.heavy;

export interface WeaponStepSpec {
  readonly motion: AttackMotionKind;
  readonly swingDurationSec: number;
  readonly windupEnd: number;
  readonly activeEnd: number;
  readonly cooldownRatio: number;
  readonly damageMult: number;
  readonly rangeMult: number;
  readonly arcMult: number;
  readonly sweepDir: 1 | -1;
  readonly goreOverride?: GoreStyle | undefined;
  readonly lungePx: number;
  readonly torsoLeanRad: number;
  readonly weightTier: WeaponWeightTier;
  readonly hitstopSec: number;
  readonly shakePx: number;
  readonly knockbackMult: number;
  readonly ignites?: boolean | undefined;
  readonly armorCrushMult?: number | undefined;
  readonly slamAoeRadius?: number | undefined;
}

export interface WeaponMovesetSpec {
  readonly archetype: WeaponArchetype;
  readonly comboWindowSec: number;
  readonly backstabMult: number;
  readonly harvestKind: HarvestToolKind;
  readonly harvestPower: number;
  readonly twoHanded?: boolean | undefined;
  readonly steps: readonly WeaponStepSpec[];
}

export const WEAPON_MOVESETS: Readonly<Record<WeaponArchetype, WeaponMovesetSpec>> = {
  sword: {
    archetype: "sword", comboWindowSec: 0.68, backstabMult: 2.25, harvestKind: "none", harvestPower: 0,
    steps: [
      { ...MED, motion: "slash", swingDurationSec: 0.25, windupEnd: 0.24, activeEnd: 0.60, cooldownRatio: 0.85, damageMult: 1.0, rangeMult: 1.0, arcMult: 1.0, sweepDir: 1, lungePx: 2.5, torsoLeanRad: 0.18 },
      { ...MED, motion: "backhand", swingDurationSec: 0.24, windupEnd: 0.22, activeEnd: 0.58, cooldownRatio: 0.85, damageMult: 1.12, rangeMult: 1.02, arcMult: 1.06, sweepDir: -1, lungePx: 2.7, torsoLeanRad: 0.20 },
      { ...MED, motion: "lunge", swingDurationSec: 0.30, windupEnd: 0.28, activeEnd: 0.64, cooldownRatio: 0.96, damageMult: 1.48, rangeMult: 1.24, arcMult: 0.62, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 4.8, torsoLeanRad: 0.26, hitstopSec: 0.056, shakePx: 2.1, knockbackMult: 1.28 },
    ],
  },
  axe: {
    archetype: "axe", comboWindowSec: 0.64, backstabMult: 2.0, harvestKind: "wood", harvestPower: 28,
    steps: [
      { ...HEAVY, motion: "chop", swingDurationSec: 0.38, windupEnd: 0.34, activeEnd: 0.62, cooldownRatio: 0.96, damageMult: 1.15, rangeMult: 1.0, arcMult: 1.08, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 3.1, torsoLeanRad: 0.28, hitstopSec: 0.062, shakePx: 2.8, knockbackMult: 1.3 },
      { ...HEAVY, motion: "cleave", swingDurationSec: 0.42, windupEnd: 0.36, activeEnd: 0.65, cooldownRatio: 0.98, damageMult: 1.38, rangeMult: 1.1, arcMult: 1.22, sweepDir: -1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 3.8, torsoLeanRad: 0.32, hitstopSec: 0.070, shakePx: 3.3, knockbackMult: 1.45 },
    ],
  },
  pickaxe: {
    archetype: "pickaxe", comboWindowSec: 0.55, backstabMult: 2.0, harvestKind: "stone", harvestPower: 28,
    steps: [
      { ...HEAVY, motion: "overheadSlam", swingDurationSec: 0.40, windupEnd: 0.40, activeEnd: 0.66, cooldownRatio: 0.98, damageMult: 1.12, rangeMult: 0.96, arcMult: 0.58, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 2.6, torsoLeanRad: 0.32, shakePx: 3.2, knockbackMult: 1.35, armorCrushMult: 1.4, slamAoeRadius: 0.65 },
    ],
  },
  torch: {
    archetype: "torch", comboWindowSec: 0.60, backstabMult: 1.75, harvestKind: "none", harvestPower: 0,
    steps: [
      { ...LIGHT, motion: "slash", swingDurationSec: 0.24, windupEnd: 0.24, activeEnd: 0.58, cooldownRatio: 0.88, damageMult: 0.95, rangeMult: 0.94, arcMult: 0.92, sweepDir: 1, lungePx: 2.0, torsoLeanRad: 0.14, hitstopSec: 0.032, shakePx: 0.9, ignites: true },
      { ...MED, motion: "thrust", swingDurationSec: 0.26, windupEnd: 0.26, activeEnd: 0.60, cooldownRatio: 0.92, damageMult: 1.15, rangeMult: 1.12, arcMult: 0.50, sweepDir: 1, lungePx: 3.4, torsoLeanRad: 0.20, hitstopSec: 0.040, shakePx: 1.2, ignites: true },
    ],
  },
  unarmed: {
    archetype: "unarmed", comboWindowSec: 0.55, backstabMult: 1.75, harvestKind: "forage", harvestPower: 14,
    steps: [
      { ...LIGHT, motion: "punch", swingDurationSec: 0.20, windupEnd: 0.22, activeEnd: 0.56, cooldownRatio: 0.84, damageMult: 1.0, rangeMult: 0.92, arcMult: 0.85, sweepDir: 1, lungePx: 2.0, torsoLeanRad: 0.14 },
      { ...LIGHT, motion: "punch", swingDurationSec: 0.20, windupEnd: 0.22, activeEnd: 0.56, cooldownRatio: 0.84, damageMult: 1.1, rangeMult: 0.96, arcMult: 0.85, sweepDir: -1, lungePx: 2.2, torsoLeanRad: 0.14 },
    ],
  },
  dagger: {
    archetype: "dagger", comboWindowSec: 0.55, backstabMult: 3.0, harvestKind: "none", harvestPower: 0,
    steps: [
      { ...LIGHT, motion: "thrust", swingDurationSec: 0.18, windupEnd: 0.22, activeEnd: 0.56, cooldownRatio: 0.82, damageMult: 0.95, rangeMult: 0.9, arcMult: 0.58, sweepDir: 1, lungePx: 2.4, torsoLeanRad: 0.14 },
      { ...LIGHT, motion: "backhand", swingDurationSec: 0.18, windupEnd: 0.22, activeEnd: 0.56, cooldownRatio: 0.82, damageMult: 1.05, rangeMult: 0.92, arcMult: 0.58, sweepDir: -1, lungePx: 2.6, torsoLeanRad: 0.16 },
      { ...LIGHT, motion: "thrust", swingDurationSec: 0.18, windupEnd: 0.24, activeEnd: 0.60, cooldownRatio: 0.90, damageMult: 1.35, rangeMult: 1.04, arcMult: 0.58, sweepDir: 1, lungePx: 3.6, torsoLeanRad: 0.22, hitstopSec: 0.036, shakePx: 0.9 },
    ],
  },
  spear: {
    archetype: "spear", comboWindowSec: 0.65, backstabMult: 2.25, harvestKind: "none", harvestPower: 0,
    steps: [
      { ...MED, motion: "thrust", swingDurationSec: 0.29, windupEnd: 0.28, activeEnd: 0.60, cooldownRatio: 0.90, damageMult: 1.05, rangeMult: 1.32, arcMult: 0.42, sweepDir: 1, lungePx: 3.6, torsoLeanRad: 0.20, knockbackMult: 1.1 },
      { ...MED, motion: "lunge", swingDurationSec: 0.33, windupEnd: 0.30, activeEnd: 0.64, cooldownRatio: 0.95, damageMult: 1.30, rangeMult: 1.46, arcMult: 0.42, sweepDir: 1, lungePx: 5.0, torsoLeanRad: 0.25, hitstopSec: 0.052, shakePx: 1.8, knockbackMult: 1.25 },
    ],
  },
  greatsword: {
    archetype: "greatsword", comboWindowSec: 0.78, backstabMult: 2.25, harvestKind: "none", harvestPower: 0, twoHanded: true,
    steps: [
      { ...HEAVY, motion: "cleave", swingDurationSec: 0.46, windupEnd: 0.38, activeEnd: 0.66, cooldownRatio: 0.96, damageMult: 1.35, rangeMult: 1.18, arcMult: 1.35, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 3.4, torsoLeanRad: 0.30, hitstopSec: 0.072, shakePx: 3.6, knockbackMult: 1.55 },
      { ...HEAVY, motion: "cleave", swingDurationSec: 0.46, windupEnd: 0.38, activeEnd: 0.68, cooldownRatio: 0.98, damageMult: 1.65, rangeMult: 1.24, arcMult: 1.35, sweepDir: -1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 4.0, torsoLeanRad: 0.34, hitstopSec: 0.075, shakePx: 4.0, knockbackMult: 1.65 },
    ],
  },
};

const ARCHETYPE_SET = new Set<string>(WEAPON_ARCHETYPES);

const asWeaponArchetype = (candidate: string | null | undefined): WeaponArchetype | undefined =>
  candidate && ARCHETYPE_SET.has(candidate) ? (candidate as WeaponArchetype) : undefined;

export function resolveWeaponArchetype(itemId: string | null | undefined, explicitArchetype?: string): WeaponArchetype {
  return asWeaponArchetype(explicitArchetype)
    ?? asWeaponArchetype(itemId ? getItemDef(itemId)?.weaponArchetype : undefined)
    ?? asWeaponArchetype(itemId)
    ?? "unarmed";
}

export function getWeaponMoveset(archetype: WeaponArchetype): WeaponMovesetSpec {
  return WEAPON_MOVESETS[archetype];
}

export function getWeaponStepSpec(archetype: WeaponArchetype, step: number): WeaponStepSpec {
  const { steps } = WEAPON_MOVESETS[archetype];
  const idx = Math.max(0, Math.min(steps.length - 1, Math.floor(step) - 1));
  const spec = steps[idx] ?? steps[0];
  if (!spec) throw new Error(`Missing step spec for weapon archetype: ${archetype}`);
  return spec;
}

export function resolveWeaponAttackStep(opts: {
  readonly archetype: WeaponArchetype;
  readonly currentStep: number;
  readonly comboActive: boolean;
}): { readonly stepIndex: number; readonly moveset: WeaponMovesetSpec; readonly spec: WeaponStepSpec } {
  const moveset = WEAPON_MOVESETS[opts.archetype];
  const count = moveset.steps.length;
  const stepIndex = opts.comboActive && opts.currentStep > 0 ? (opts.currentStep % count) + 1 : 1;
  return { stepIndex, moveset, spec: getWeaponStepSpec(opts.archetype, stepIndex) };
}
