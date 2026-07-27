// Landing squash curve: a quick horizontal stretch / vertical compress that springs back
// to neutral — VISUAL_DIRECTION's "squash on landing" movement-feel requirement, kept
// pure (like hitFlash.ts/lift.ts) so the curve is unit-testable apart from Phaser.
export const SQUASH_DURATION_MS = 180;

const SQUASH_MAX_X = 1.26;
const SQUASH_MAX_Y = 0.76;

export interface Squash {
  readonly scaleX: number;
  readonly scaleY: number;
}

/** Neutral (1,1) outside the active window; peaks immediately on landing then eases back by SQUASH_DURATION_MS. */
export function squashScale(elapsedMs: number): Squash {
  if (elapsedMs < 0 || elapsedMs >= SQUASH_DURATION_MS) return { scaleX: 1, scaleY: 1 };
  const ease = 1 - elapsedMs / SQUASH_DURATION_MS;
  return {
    scaleX: 1 + (SQUASH_MAX_X - 1) * ease,
    scaleY: 1 + (SQUASH_MAX_Y - 1) * ease,
  };
}
