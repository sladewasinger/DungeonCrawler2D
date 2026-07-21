// The seam's discrete camera state: which of the 4 cardinal rotations the view currently
// sits at. Continuous in-between angles (the Q/E tween) are owned by rotationTween.ts —
// this type is only ever one of the 4 settled values, since direction remap / depth sort /
// autotile borders are all defined at these 90-degree steps (crossfade at the 45-degree
// midpoint is how the tween hides the discontinuity between two settled states).
export type ViewOrientation = 0 | 90 | 180 | 270;

export const VIEW_ORIENTATIONS: readonly ViewOrientation[] = [0, 90, 180, 270];

/**
 * Wraps ANY real-valued angle into [0, 360) — the general-purpose helper for continuous
 * angles (the Q/E tween's in-between degrees) that are never one of the 4 settled
 * ViewOrientation values. normalizeOrientation (below) is the narrower, ViewOrientation-typed
 * sibling for genuine 90-degree-multiple inputs; it must not be reused for continuous
 * angles via an unsafe cast (the smell this helper replaces — rotationTween.ts's
 * rotationTweenAngle used to wrap-then-cast through normalizeOrientation, silently
 * claiming a fractional mid-tween angle like 45 was one of 0|90|180|270).
 */
export function wrapDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Wraps any integer multiple of 90 into the 0..270 range (e.g. -90 -> 270, 450 -> 90). */
export function normalizeOrientation(degrees: number): ViewOrientation {
  return wrapDegrees(degrees) as ViewOrientation;
}

/**
 * Steps one 90-degree increment: `dir` 1 rotates clockwise (matches the brief's "E"
 * key), -1 counter-clockwise ("Q"). Orientation cycles N -> E -> S -> W -> N as it
 * climbs (see directionRemap.ts's `screenSouthWorldDirection` for what that means
 * on screen).
 */
export function rotateOrientation(current: ViewOrientation, dir: 1 | -1): ViewOrientation {
  return normalizeOrientation(current + dir * 90);
}
