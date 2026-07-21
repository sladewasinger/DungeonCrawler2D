// Pure math for the HUD compass needle (LANE W2 step 2): the on-screen bearing (degrees,
// 0 = screen-up, clockwise-positive) that currently points toward WORLD NORTH. Reuses
// rotationTween's own continuous mid-tween angle so the needle animates smoothly across
// the full 250ms tween regardless of when terrain/lighting/movement hard-swap
// (rotationControl.ts's own, separate, 45-degree-midpoint timing) — the compass is a
// cheap 2D dial with no baked-per-orientation content to swap, so it can afford to just
// tell the truth continuously the whole time.
import { rotationTweenAngle, wrapDegrees, type RotationTween, type ViewOrientation } from "../../render/view/index.js";

/**
 * `orientation`/`tween` follow the same "settled vs. mid-tween" split every other seam
 * consumer uses: pass the live tween while one's in flight (rotationController.ts owns
 * it), or null once settled — the needle then just reflects `orientation` directly.
 */
export function compassBearingDeg(orientation: ViewOrientation, tween: RotationTween | null): number {
  const angle = tween ? rotationTweenAngle(tween) : orientation;
  return wrapDegrees(-angle);
}
