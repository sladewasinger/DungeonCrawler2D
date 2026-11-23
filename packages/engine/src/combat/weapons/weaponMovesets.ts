/** Extensible per-weapon melee moveset registry, motion styles, timing, and harvest tool hooks. */
import type { GoreStyle } from "../combatRules.js";

export const WEAPON_ARCHETYPES = [
  "sword", "axe", "pickaxe", "torch", "unarmed", "spear", "dagger", "greatsword",
] as const;

export type WeaponArchetype = (typeof WEAPON_ARCHETYPES)[number];
export type AttackMotionKind = "slash" | "backhand" | "lunge" | "chop" | "overheadSlam" | "thrust" | "cleave";
export type HarvestToolKind = "none" | "wood" | "stone" | "forage";
const GORE_CHUNK_SPRAY: GoreStyle = "chunk-spray";

export interface WeaponStepSpec {
  readonly motion: AttackMotionKind;
  readonly swingDurationSec: number;
  readonly cooldownRatio: number;
  readonly damageMult: number;
  readonly rangeMult: number;
  readonly arcMult: number;
  readonly sweepDir: 1 | -1;
  readonly goreOverride?: GoreStyle | undefined;
  readonly lungePx: number;
  readonly torsoLeanRad: number;
  readonly ignites?: boolean | undefined;
}

export interface WeaponMovesetSpec {
  readonly archetype: WeaponArchetype;
  readonly comboWindowSec: number;
  readonly backstabMult: number;
  readonly harvestKind: HarvestToolKind;
  readonly harvestPower: number;
  readonly steps: readonly WeaponStepSpec[];
}

export const WEAPON_MOVESETS: Readonly<Record<WeaponArchetype, WeaponMovesetSpec>> = {
  sword: {
    archetype: "sword", comboWindowSec: 0.68, backstabMult: 2.25, harvestKind: "none", harvestPower: 0,
    steps: [
      { motion: "slash", swingDurationSec: 0.25, cooldownRatio: 0.85, damageMult: 1.0, rangeMult: 1.0, arcMult: 1.0, sweepDir: 1, lungePx: 2.5, torsoLeanRad: 0.18 },
      { motion: "backhand", swingDurationSec: 0.24, cooldownRatio: 0.85, damageMult: 1.12, rangeMult: 1.02, arcMult: 1.06, sweepDir: -1, lungePx: 2.7, torsoLeanRad: 0.20 },
      { motion: "lunge", swingDurationSec: 0.30, cooldownRatio: 0.96, damageMult: 1.48, rangeMult: 1.24, arcMult: 0.62, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 4.8, torsoLeanRad: 0.26 },
    ],
  },
  axe: {
    archetype: "axe", comboWindowSec: 0.55, backstabMult: 2.0, harvestKind: "wood", harvestPower: 28,
    steps: [
      { motion: "chop", swingDurationSec: 0.38, cooldownRatio: 0.96, damageMult: 1.15, rangeMult: 1.0, arcMult: 1.08, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 3.1, torsoLeanRad: 0.28 },
    ],
  },
  pickaxe: {
    archetype: "pickaxe", comboWindowSec: 0.55, backstabMult: 2.0, harvestKind: "stone", harvestPower: 28,
    steps: [
      { motion: "overheadSlam", swingDurationSec: 0.40, cooldownRatio: 0.98, damageMult: 1.12, rangeMult: 0.96, arcMult: 0.58, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 2.6, torsoLeanRad: 0.32 },
    ],
  },
  torch: {
    archetype: "torch", comboWindowSec: 0.60, backstabMult: 1.75, harvestKind: "none", harvestPower: 0,
    steps: [
      { motion: "slash", swingDurationSec: 0.24, cooldownRatio: 0.88, damageMult: 0.95, rangeMult: 0.94, arcMult: 0.92, sweepDir: 1, lungePx: 2.0, torsoLeanRad: 0.14, ignites: true },
      { motion: "thrust", swingDurationSec: 0.26, cooldownRatio: 0.92, damageMult: 1.15, rangeMult: 1.12, arcMult: 0.50, sweepDir: 1, lungePx: 3.4, torsoLeanRad: 0.20, ignites: true },
    ],
  },
  unarmed: {
    archetype: "unarmed", comboWindowSec: 0.55, backstabMult: 1.75, harvestKind: "forage", harvestPower: 14,
    steps: [
      { motion: "slash", swingDurationSec: 0.21, cooldownRatio: 0.86, damageMult: 1.0, rangeMult: 1.0, arcMult: 1.0, sweepDir: 1, lungePx: 1.8, torsoLeanRad: 0.14 },
      { motion: "backhand", swingDurationSec: 0.21, cooldownRatio: 0.86, damageMult: 1.1, rangeMult: 1.02, arcMult: 1.0, sweepDir: -1, lungePx: 1.8, torsoLeanRad: 0.14 },
    ],
  },
  dagger: {
    archetype: "dagger", comboWindowSec: 0.55, backstabMult: 3.0, harvestKind: "none", harvestPower: 0,
    steps: [
      { motion: "thrust", swingDurationSec: 0.18, cooldownRatio: 0.82, damageMult: 0.95, rangeMult: 0.9, arcMult: 0.58, sweepDir: 1, lungePx: 2.4, torsoLeanRad: 0.14 },
      { motion: "backhand", swingDurationSec: 0.18, cooldownRatio: 0.82, damageMult: 1.05, rangeMult: 0.92, arcMult: 0.58, sweepDir: -1, lungePx: 2.6, torsoLeanRad: 0.16 },
      { motion: "thrust", swingDurationSec: 0.18, cooldownRatio: 0.90, damageMult: 1.35, rangeMult: 1.04, arcMult: 0.58, sweepDir: 1, lungePx: 3.6, torsoLeanRad: 0.22 },
    ],
  },
  spear: {
    archetype: "spear", comboWindowSec: 0.65, backstabMult: 2.25, harvestKind: "none", harvestPower: 0,
    steps: [
      { motion: "thrust", swingDurationSec: 0.29, cooldownRatio: 0.90, damageMult: 1.05, rangeMult: 1.32, arcMult: 0.42, sweepDir: 1, lungePx: 3.6, torsoLeanRad: 0.20 },
      { motion: "lunge", swingDurationSec: 0.33, cooldownRatio: 0.95, damageMult: 1.30, rangeMult: 1.46, arcMult: 0.42, sweepDir: 1, lungePx: 5.0, torsoLeanRad: 0.25 },
    ],
  },
  greatsword: {
    archetype: "greatsword", comboWindowSec: 0.78, backstabMult: 2.25, harvestKind: "none", harvestPower: 0,
    steps: [
      { motion: "cleave", swingDurationSec: 0.46, cooldownRatio: 0.96, damageMult: 1.35, rangeMult: 1.18, arcMult: 1.35, sweepDir: 1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 3.4, torsoLeanRad: 0.30 },
      { motion: "cleave", swingDurationSec: 0.46, cooldownRatio: 0.98, damageMult: 1.65, rangeMult: 1.24, arcMult: 1.35, sweepDir: -1, goreOverride: GORE_CHUNK_SPRAY, lungePx: 4.0, torsoLeanRad: 0.34 },
    ],
  },
};

const ARCHETYPE_SET = new Set<string>(WEAPON_ARCHETYPES);

export function resolveWeaponArchetype(itemId: string | null | undefined, explicitArchetype?: string): WeaponArchetype {
  if (explicitArchetype && ARCHETYPE_SET.has(explicitArchetype)) return explicitArchetype as WeaponArchetype;
  if (itemId && ARCHETYPE_SET.has(itemId)) return itemId as WeaponArchetype;
  return "unarmed";
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
