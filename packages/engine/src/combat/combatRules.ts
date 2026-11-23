/** Pure combat math, sanctuary protection, bow ballistics, hurtbox geometry, and gore definitions. */
import type { EntityKind } from "./aiSensing.js";

export const GORE_SUBSTANCES = ["blood", "slime", "ichor", "straw", "bone", "stone"] as const;
export type GoreSubstance = (typeof GORE_SUBSTANCES)[number];

export const GORE_STYLES = ["splatter", "thin-streak", "drip", "chunk-spray", "explode-away"] as const;
export type GoreStyle = (typeof GORE_STYLES)[number];

export const COMBAT_TUNING = {
  sanctuary: { centerX: 0.5, centerY: 0.5, radiusTiles: 7.5 },
  vitals: { maxHp: 100, maxStamina: 100, staminaRegenPerSec: 24, blockStaminaRegenMult: 0.45 },
  movement: { runSpeedTilesPerSec: 5.6, walkSpeedRatio: 0.5, joystickDeadzone: 0.14, collisionRadiusTiles: 0.28 },
  movementMults: { dodge: 1.9, swing: 0.55, block: 0.6, bowDraw: 0.78, shallowWater: 0.78, deepWater: 0.56, exhaustedSwim: 0.36 },
  swim: { staminaDrainPerSec: 7, idleTreadRegenPerSec: 4 },
  dodge: { staminaCost: 22, durationSec: 0.30, iframeSec: 0.24, cooldownSec: 0.55 },
  melee: { comboWindowSec: 0.65, swingSec: 0.26, comboDamageMult: [1.0, 1.1, 1.45] as const },
  defense: { parryWindowSec: 0.22, parryStaggerSec: 1.45, blockStaminaDrain: 10, hitIframeSec: 0.42 },
  bow: { maxChargeSec: 0.85, minSpeedTilesPerSec: 11, extraSpeedTilesPerSec: 9, minDamageMult: 0.55, extraDamageMult: 0.8, staminaCost: 10 },
  bleed: { durationSec: 3.5 },
} as const;

export const SANCTUARY_CENTER = { x: COMBAT_TUNING.sanctuary.centerX, y: COMBAT_TUNING.sanctuary.centerY } as const;
export const SANCTUARY_RADIUS = COMBAT_TUNING.sanctuary.radiusTiles;

export const MAX_PLAYER_HP = COMBAT_TUNING.vitals.maxHp;
export const MAX_PLAYER_STAMINA = COMBAT_TUNING.vitals.maxStamina;
export const STAMINA_REGEN_PER_SEC = COMBAT_TUNING.vitals.staminaRegenPerSec;

export const DODGE_STAMINA_COST = COMBAT_TUNING.dodge.staminaCost;
export const DODGE_DURATION_SEC = COMBAT_TUNING.dodge.durationSec;
export const DODGE_IFRAME_SEC = COMBAT_TUNING.dodge.iframeSec;
export const DODGE_COOLDOWN_SEC = COMBAT_TUNING.dodge.cooldownSec;
export const DODGE_SPEED_MULT = COMBAT_TUNING.movementMults.dodge;

export const COMBO_WINDOW_SEC = COMBAT_TUNING.melee.comboWindowSec;
export const COMBO_SWING_SEC = COMBAT_TUNING.melee.swingSec;
export const COMBO_DAMAGE_MULT = COMBAT_TUNING.melee.comboDamageMult;

export const PARRY_WINDOW_SEC = COMBAT_TUNING.defense.parryWindowSec;
export const PARRY_STAGGER_SEC = COMBAT_TUNING.defense.parryStaggerSec;
export const HIT_IFRAME_SEC = COMBAT_TUNING.defense.hitIframeSec;
export const BLEED_DURATION_SEC = COMBAT_TUNING.bleed.durationSec;
export const BOW_MAX_CHARGE_SEC = COMBAT_TUNING.bow.maxChargeSec;

export interface Vec2Like {
  readonly x: number;
  readonly y: number;
}

export function isInSanctuary(x: number, y: number): boolean {
  return Math.hypot(x - SANCTUARY_CENTER.x, y - SANCTUARY_CENTER.y) <= SANCTUARY_RADIUS;
}

export function comboMultiplier(step: number): number {
  const idx = Math.max(0, Math.min(COMBO_DAMAGE_MULT.length - 1, step - 1));
  return COMBO_DAMAGE_MULT[idx] ?? 1.0;
}

export function evaluateBowShot(chargeSec: number): {
  readonly ratio: number;
  readonly speedTilesPerSec: number;
  readonly damageMult: number;
} {
  const { maxChargeSec, minSpeedTilesPerSec, extraSpeedTilesPerSec, minDamageMult, extraDamageMult } = COMBAT_TUNING.bow;
  const ratio = Math.max(0, Math.min(1, chargeSec / maxChargeSec));
  return {
    ratio,
    speedTilesPerSec: minSpeedTilesPerSec + ratio * extraSpeedTilesPerSec,
    damageMult: minDamageMult + ratio * extraDamageMult,
  };
}

export function computeMitigatedDamage(rawDamage: number, defense: number): number {
  const factor = 100 / (100 + Math.max(0, defense) * 6);
  return Math.max(1, Math.round(rawDamage * factor));
}

export function isWithinSector(input: {
  readonly origin: Vec2Like;
  readonly dir: Vec2Like;
  readonly target: Vec2Like;
  readonly range: number;
  readonly halfArcRad: number;
}): boolean {
  const dx = input.target.x - input.origin.x;
  const dy = input.target.y - input.origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > input.range) return false;
  if (dist < 0.001) return true;
  const dirMag = Math.hypot(input.dir.x, input.dir.y);
  if (dirMag < 0.001) return true;
  const cosAngle = (dx * input.dir.x + dy * input.dir.y) / (dist * dirMag);
  return cosAngle >= Math.cos(input.halfArcRad);
}

export interface EllipseHurtbox {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

const FOOT_RADIUS_BY_KIND: Readonly<Record<EntityKind, number>> = {
  dummy: 0.36,
  "slime-dummy": 0.34,
  "spar-dummy": 0.38,
  wolf: 0.38,
  bear: 0.56,
  spider: 0.36,
  boar: 0.44,
  slime: 0.34,
  goblin: 0.36,
  orc: 0.48,
  skeleton: 0.36,
  golem: 0.62,
};

export function entityFootRadius(kind?: EntityKind): number {
  return kind ? FOOT_RADIUS_BY_KIND[kind] : 0.38;
}

export function projectileHurtbox(pos: Vec2Like, kind?: EntityKind): EllipseHurtbox {
  const foot = kind ? FOOT_RADIUS_BY_KIND[kind] : COMBAT_TUNING.movement.collisionRadiusTiles;
  return { cx: pos.x, cy: pos.y - 0.1, rx: foot + 0.34, ry: foot + 0.54 };
}

export function playerProjectileHurtbox(pos: Vec2Like): EllipseHurtbox {
  const foot = COMBAT_TUNING.movement.collisionRadiusTiles;
  return { cx: pos.x, cy: pos.y - 0.1, rx: foot + 0.24, ry: foot + 0.4 };
}

export function segmentHitsEllipse(seg: {
  readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number;
  readonly box: EllipseHurtbox;
}): number | null {
  const { box } = seg;
  const scaleY = box.rx / Math.max(0.05, box.ry);
  const ax = seg.x0 - box.cx;
  const ay = (seg.y0 - box.cy) * scaleY;
  const bx = seg.x1 - box.cx;
  const by = (seg.y1 - box.cy) * scaleY;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 1e-8 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0;
  const px = ax + dx * t;
  const py = ay + dy * t;
  return px * px + py * py <= box.rx * box.rx ? t : null;
}
