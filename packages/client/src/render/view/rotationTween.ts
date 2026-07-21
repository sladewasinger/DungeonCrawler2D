// Pure state machine for the Q/E ~250ms rotation tween (brief's step 3, "game rotation
// UX"). Owns only the numbers — no Phaser, no scene wiring — so scenes/HUD can drive it
// from their own update loop and tests can advance it in fixed steps without a renderer.
import { rotateOrientation, wrapDegrees, type ViewOrientation } from "./viewOrientation.js";

/** 120ms: the lean-then-snap completes its snap at the 60ms midpoint — near-live
 * rotation the user can chain continuously ("almost live and constantly", user
 * directive 2026-07-21; was 250ms, which read as a half-second-plus per step once
 * the input-eaten window and rebake stacked on top). */
export const ROTATION_TWEEN_MS = 120;

export interface RotationTween {
  readonly from: ViewOrientation;
  readonly to: ViewOrientation;
  readonly stepDir: 1 | -1;
  readonly elapsedMs: number;
}

/** Begins a tween from `current` one 90-degree step in `dir` (1 = clockwise / "E", -1 = "Q"). */
export function startRotationTween(current: ViewOrientation, dir: 1 | -1): RotationTween {
  return { from: current, to: rotateOrientation(current, dir), stepDir: dir, elapsedMs: 0 };
}

/** Advances the tween by `dtMs`, clamped so it never overshoots its own duration. */
export function advanceRotationTween(tween: RotationTween, dtMs: number): RotationTween {
  return { ...tween, elapsedMs: Math.min(ROTATION_TWEEN_MS, tween.elapsedMs + dtMs) };
}

export function isRotationTweenDone(tween: RotationTween): boolean {
  return tween.elapsedMs >= ROTATION_TWEEN_MS;
}

/** 0 at the tween's start, 1 once settled at `to`. */
export function rotationTweenProgress(tween: RotationTween): number {
  return tween.elapsedMs / ROTATION_TWEEN_MS;
}

/**
 * Continuous in-between angle (not clamped to the 4 settled orientations) — what the
 * floor plane / entities should SMOOTH-rotate to mid-tween. Callers needing a settled
 * `ViewOrientation` for direction remap/depth sort/borders use `.to` once
 * isRotationTweenDone, never this value. Uses wrapDegrees, NOT normalizeOrientation —
 * this angle is genuinely fractional mid-tween (e.g. 45), so casting it through
 * normalizeOrientation's ViewOrientation return type would be an unsafe lie about its
 * type (the smell flagged for this pass: normalizeOrientation is for real 90-degree-
 * multiple values only).
 */
export function rotationTweenAngle(tween: RotationTween): number {
  return wrapDegrees(tween.from + tween.stepDir * 90 * rotationTweenProgress(tween));
}

/**
 * True once progress has crossed the 45-degree midpoint — the moment the brief says the
 * wall-face/occluder layer should crossfade to the new orientation's faces (ASSUMPTION:
 * a hard swap at the midpoint rather than a soft alpha-blend across the whole tween, see
 * docs/ASSUMPTIONS.md — logged for the user veto since a soft crossfade may read better).
 */
export function isPastCrossfadeMidpoint(tween: RotationTween): boolean {
  return rotationTweenProgress(tween) >= 0.5;
}
