import { afterEach, describe, expect, it, vi } from "vitest";
import { getViewOrientation, resetViewOrientation } from "../../render/view/viewState.js";
import { RotationController } from "./rotationControl.js";

afterEach(() => resetViewOrientation());

describe("RotationController", () => {
  it("does nothing until requested", () => {
    const controller = new RotationController();
    const invalidate = vi.fn();
    controller.update(16, invalidate);
    expect(invalidate).not.toHaveBeenCalled();
    expect(controller.tweening).toBe(false);
    expect(controller.cameraRotationRad()).toBe(0);
  });

  it("chains a second request landing mid-tween — it starts the moment the first snaps", () => {
    const controller = new RotationController();
    controller.request(1);
    controller.request(-1); // queued (one-deep) — held-key continuous spin
    controller.update(250, () => {}); // crosses the first midpoint: snap to 90, chain starts
    expect(getViewOrientation()).toBe(90);
    expect(controller.tweening).toBe(true); // the chained -1 step is already running
    controller.update(250, () => {}); // crosses the chained midpoint: back to 0
    expect(getViewOrientation()).toBe(0);
  });

  it("swaps the settled orientation exactly once, at the midpoint (120ms tween: 60ms)", () => {
    const controller = new RotationController();
    const invalidate = vi.fn();
    controller.request(1);
    expect(getViewOrientation()).toBe(0); // unswapped pre-midpoint
    controller.update(40, invalidate); // 40/120 = 33% — still pre-midpoint
    expect(invalidate).not.toHaveBeenCalled();
    expect(getViewOrientation()).toBe(0);
    controller.update(30, invalidate); // 70/120 = 58% — past the midpoint
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getViewOrientation()).toBe(90);
    expect(controller.tweening).toBe(false); // snap ends the tween — nothing to unwind
    controller.update(120, invalidate); // idle no-op
    expect(invalidate).toHaveBeenCalledTimes(1); // never fires twice for one step
  });

  it("leans opposite-sign toward the snap, then returns to exactly 0 the instant the swap lands", () => {
    // Hand-derived (LEAN_DEG 14, easeOutQuad over the first half of the 120ms tween):
    //   30ms -> p=0.25 -> leanT 0.5 -> ease 1-(0.5)^2 = 0.75 -> angle = -1 * 14 * 0.75 = -10.5deg
    // (negative for stepDir=+1: Phaser camera.rotation +theta shows the world rotated
    //  CW, while the +1 content swap rotates it CCW — the lean must preview the snap).
    const controller = new RotationController();
    controller.request(1);
    controller.update(0, () => {});
    expect(controller.cameraRotationRad()).toBeCloseTo(0);
    controller.update(30, () => {}); // progress 0.25
    expect(controller.cameraRotationRad()).toBeCloseTo((-10.5 * Math.PI) / 180, 5);
    controller.update(31, () => {}); // 61/120 — crosses the midpoint: SNAP
    expect(controller.cameraRotationRad()).toBe(0); // no post-swap phase at all
    expect(controller.tweening).toBe(false);
    expect(getViewOrientation()).toBe(90);
  });

  it("a held key spins a full circle: four chained steps land back at start, one rebake each", () => {
    const controller = new RotationController();
    const invalidate = vi.fn();
    for (let step = 0; step < 4; step++) {
      controller.request(1);
      controller.update(250, invalidate); // each call crosses one midpoint
    }
    expect(getViewOrientation()).toBe(0);
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it("bearingDeg matches the settled orientation once idle", () => {
    const controller = new RotationController();
    expect(controller.bearingDeg()).toBe(0);
    controller.request(1);
    controller.update(250, () => {});
    expect(controller.bearingDeg()).toBe(270);
  });
});
