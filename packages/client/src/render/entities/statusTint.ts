// Status tint chips: a looping flicker color for burning/poisoned, read off the
// snapshot's `fx` status-id list (server truth, never inferred client-side) — the
// VISUAL_DIRECTION accent palette carries the read (fire orange, poison green).
const BURNING_COLOR = 0xff9e3d;
const POISONED_COLOR = 0x7bd44a;
const FLICKER_PERIOD_MS = 260;
const FLICKER_MIN_ALPHA = 0.35;
const FLICKER_MAX_ALPHA = 0.85;

export interface StatusTint {
  readonly color: number;
  readonly alpha: number;
}

/** The strongest active status tint for an entity's fx list (burning wins over poisoned), or null if neither is up. */
export function statusTintFor(fx: readonly string[], nowMs: number): StatusTint | null {
  const color = fx.includes("on-fire") ? BURNING_COLOR : fx.includes("poisoned") ? POISONED_COLOR : null;
  if (color === null) return null;
  const phase = (nowMs % FLICKER_PERIOD_MS) / FLICKER_PERIOD_MS;
  const wave = (Math.sin(phase * Math.PI * 2) + 1) / 2;
  return { color, alpha: FLICKER_MIN_ALPHA + wave * (FLICKER_MAX_ALPHA - FLICKER_MIN_ALPHA) };
}

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function lerpChannel(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

/** Blends a status color toward neutral white by (1 - alpha) into one Phaser multiply-tint. */
export function compositeStatusTint(tint: StatusTint): number {
  const r = lerpChannel(255, channel(tint.color, 16), tint.alpha);
  const g = lerpChannel(255, channel(tint.color, 8), tint.alpha);
  const b = lerpChannel(255, channel(tint.color, 0), tint.alpha);
  return (r << 16) | (g << 8) | b;
}
