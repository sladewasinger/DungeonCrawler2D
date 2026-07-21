/**
 * Drives the LANE W2 camera-rotation UX: owns the rotationTween state machine
 * (render/view/rotationTween.ts) and performs the ONE hard content swap — flipping the
 * seam's settled ViewState and forcing a terrain/lighting rebake — at the tween's
 * 45-degree crossfade midpoint (docs/ASSUMPTIONS.md row 253's existing hard-swap
 * default, extended here to the whole terrain pipeline: chunkVisual bakes floor + wall +
 * occluder into one composited texture per chunk, so a floor-only-continuous /
 * wall-only-at-midpoint split would need a larger Phaser-layer refactor out of this
 * pass's scope — see the ASSUMPTIONS log for the full writeup). A short cosmetic camera
 * spin (cameraRotation()) covers the swap with a continuous 250ms visual instead of a
 * jump-cut, compensating exactly at the swap instant so the two halves read as one motion.
 * Phaser-free by design (like every render/view/* module) — DungeonScene wires it to a
 * real camera and to TerrainRenderer/LightingSystem's invalidateAll().
 */
import {
  advanceRotationTween,
  isPastCrossfadeMidpoint,
  isRotationTweenDone,
  rotationTweenProgress,
  startRotationTween,
  type RotationTween,
} from "../../render/view/rotationTween.js";
import { getViewOrientation, setViewOrientation } from "../../render/view/viewState.js";
import { compassBearingDeg } from "./compassBearing.js";

/** How far the pre-snap lean tilts, in degrees — "a slight fake rotation towards the
 * proper direction, and then everything is snapped over" (user directive 2026-07-20,
 * replacing the two-phase compensated spin whose sign mismatch with Phaser's camera
 * rotation read as a wrong-way 720 "twister"). Vetoable knob. */
const LEAN_DEG = 14;

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * The lean, in camera-rotation degrees. Sign: Phaser camera.rotation +θ makes the WORLD
 * appear rotated CW on screen, while a stepDir=+1 orientation swap rotates content CCW
 * (east moves screen-right -> screen-up per worldToView) — so the camera must lean
 * NEGATIVE stepDir for the world to tilt toward where the snap will take it. The tween
 * ends AT the snap (update() below), so there is no post-swap phase at all.
 */
function cameraFxDeg(tween: RotationTween): number {
  const progress = rotationTweenProgress(tween);
  const leanT = Math.min(1, progress / 0.5);
  return -tween.stepDir * LEAN_DEG * easeOutQuad(leanT);
}

export class RotationController {
  private tween: RotationTween | null = null;
  private swapped = false;

  /**
   * Starts one 90-degree step in `dir` (1 = the "E"-direction/clockwise, -1 = "Q"/ccw,
   * per docs/ASSUMPTIONS.md row 252's convention) — ignored while a tween is already in
   * flight rather than queuing a second step, a deliberate brief input-eating window
   * (vetoable, logged) simpler than chaining or interrupting an in-progress rotation.
   */
  request(dir: 1 | -1): void {
    if (this.tween) return;
    this.tween = startRotationTween(getViewOrientation(), dir);
    this.swapped = false;
  }

  /**
   * Advances the tween by `dtMs`; `invalidate` fires exactly once, the instant progress
   * crosses the 45-degree midpoint — flips the seam's settled orientation and should
   * trigger a fresh terrain/lighting rebake there (kept as a callback so this module
   * never touches Phaser/TerrainRenderer directly).
   */
  update(dtMs: number, invalidate: () => void): void {
    if (!this.tween) return;
    this.tween = advanceRotationTween(this.tween, dtMs);
    if (!this.swapped && isPastCrossfadeMidpoint(this.tween)) {
      // Lean-then-SNAP: the swap ends the whole tween in the same instant — camera
      // rotation returns to exactly 0, the content lands in the new orientation, and
      // there is no post-swap animation to unwind (user directive; the old second
      // half read as a "crazy twister").
      this.swapped = true;
      setViewOrientation(this.tween.to);
      invalidate();
      this.tween = null;
      return;
    }
    if (isRotationTweenDone(this.tween)) this.tween = null;
  }

  /** This frame's cosmetic camera spin, in radians — 0 while idle. */
  cameraRotationRad(): number {
    if (!this.tween) return 0;
    return (cameraFxDeg(this.tween) * Math.PI) / 180;
  }

  /** HUD compass's live bearing (0 = world-north at screen-up), continuous through the tween. */
  bearingDeg(): number {
    return compassBearingDeg(getViewOrientation(), this.tween);
  }

  get tweening(): boolean {
    return this.tween !== null;
  }
}
