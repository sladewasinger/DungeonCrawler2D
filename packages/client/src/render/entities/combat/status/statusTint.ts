import { STATUS_VISUAL_STYLE } from "./statusVisualStyle.js";

const BURNING_COLOR = 0xff9e3d;
const BURNING_PERIOD_MS = 260;
const DOWNED_COLOR = 0x7a3d3d;
const DISCONNECTED_COLOR = 0x55555a;
const TELEGRAPH_COLOR = 0xffb37a;
const CLEAR_MODE = "clear";
const MULTIPLY_MODE = "multiply";
const FILL_MODE = "fill";
const ON_FIRE_STATUS = "on-fire";
const POISONED_STATUS = "poisoned";
const NORMAL_LAYER = "normal";
const DAMAGE_FLASH_LAYER = "damage-flash";
const DOWNED_LAYER = "downed";
const DISCONNECTED_LAYER = "disconnected";
const TELEGRAPH_LAYER = "telegraph";
const NONE_SOURCE = "none";

export type CombatantStateVisual =
  typeof NORMAL_LAYER | typeof DOWNED_LAYER | typeof DISCONNECTED_LAYER;
export type CombatantTintLayer =
  CombatantStateVisual | typeof DAMAGE_FLASH_LAYER | typeof TELEGRAPH_LAYER;
export type TintMode =
  typeof CLEAR_MODE | typeof MULTIPLY_MODE | typeof FILL_MODE;
export type TintSource =
  typeof NONE_SOURCE | CombatantTintLayer |
  typeof ON_FIRE_STATUS | typeof POISONED_STATUS;

export interface CombatantTint {
  readonly mode: TintMode;
  readonly color: number;
  readonly blend: number;
  readonly source: TintSource;
}

const CLEAR_TINT: CombatantTint = { mode: CLEAR_MODE, color: 0xffffff, blend: 0, source: NONE_SOURCE };
const DAMAGE_FLASH: CombatantTint = { mode: FILL_MODE, color: 0xffffff, blend: 1, source: DAMAGE_FLASH_LAYER };
const DOWNED_TINT: CombatantTint = { mode: MULTIPLY_MODE, color: DOWNED_COLOR, blend: 1, source: DOWNED_LAYER };
const DISCONNECTED_TINT: CombatantTint = { mode: MULTIPLY_MODE, color: DISCONNECTED_COLOR, blend: 1, source: DISCONNECTED_LAYER };
const TELEGRAPH_TINT: CombatantTint = { mode: MULTIPLY_MODE, color: TELEGRAPH_COLOR, blend: 1, source: TELEGRAPH_LAYER };
const POISONED_TINT = blendedTint(
  STATUS_VISUAL_STYLE.poisoned.color,
  STATUS_VISUAL_STYLE.poisoned.blend,
  POISONED_STATUS,
);
const BURNING_TINTS = [
  blendedTint(BURNING_COLOR, 0.35, ON_FIRE_STATUS),
  blendedTint(BURNING_COLOR, 0.5, ON_FIRE_STATUS),
  blendedTint(BURNING_COLOR, 0.65, ON_FIRE_STATUS),
  blendedTint(BURNING_COLOR, 0.5, ON_FIRE_STATUS),
] as const;

function blendedTint(color: number, blend: number, source: TintSource): CombatantTint {
  return { mode: MULTIPLY_MODE, color: blendTintWithWhite(color, blend), blend, source };
}

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function lerpChannel(from: number, to: number, amount: number): number {
  return Math.round(from + (to - from) * amount);
}

/** Converts an overlay blend into the equivalent neutral-based Phaser multiply tint. */
export function blendTintWithWhite(color: number, amount: number): number {
  const r = lerpChannel(255, channel(color, 16), amount);
  const g = lerpChannel(255, channel(color, 8), amount);
  const b = lerpChannel(255, channel(color, 0), amount);
  return (r << 16) | (g << 8) | b;
}

function statusTint(fx: readonly string[], nowMs: number): CombatantTint | null {
  if (fx.includes(ON_FIRE_STATUS)) {
    const index = Math.floor((nowMs % BURNING_PERIOD_MS) / (BURNING_PERIOD_MS / BURNING_TINTS.length));
    return BURNING_TINTS[index] ?? BURNING_TINTS[0];
  }
  return fx.includes(POISONED_STATUS) ? POISONED_TINT : null;
}

export function resolveCombatantTintLayer(
  damageFlashing: boolean,
  state: CombatantStateVisual,
  telegraphing: boolean,
): CombatantTintLayer {
  if (damageFlashing) return DAMAGE_FLASH_LAYER;
  if (state !== NORMAL_LAYER) return state;
  return telegraphing ? TELEGRAPH_LAYER : NORMAL_LAYER;
}

function layerTint(layer: CombatantTintLayer): CombatantTint | null {
  if (layer === DAMAGE_FLASH_LAYER) return DAMAGE_FLASH;
  if (layer === DOWNED_LAYER) return DOWNED_TINT;
  if (layer === DISCONNECTED_LAYER) return DISCONNECTED_TINT;
  return layer === TELEGRAPH_LAYER ? TELEGRAPH_TINT : null;
}

/**
 * Shared precedence for every combatant: flash > life/connection state >
 * attack telegraph > replicated status > natural sprite color.
 */
export function resolveCombatantTint(
  fx: readonly string[],
  nowMs: number,
  layer: CombatantTintLayer,
): CombatantTint {
  const fixed = layerTint(layer);
  if (fixed) return fixed;
  return statusTint(fx, nowMs) ?? CLEAR_TINT;
}

export interface TintableSprite {
  setTint(color: number): unknown;
  clearTint(): unknown;
  setTintMode?(mode: number): unknown;
}

/** Applies the semantic result and resets Phaser's fill mode so pooled sprites cannot retain it. */
export function applyCombatantTint(sprite: TintableSprite, presentation: CombatantTint): void {
  if (presentation.mode === CLEAR_MODE) {
    sprite.setTintMode?.(0);
    sprite.clearTint();
    return;
  }
  sprite.setTint(presentation.color);
  sprite.setTintMode?.(presentation.mode === FILL_MODE ? 1 : 0);
}
