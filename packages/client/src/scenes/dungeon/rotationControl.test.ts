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

  it("ignores a second request while one is already in flight", () => {
    const controller = new RotationController();
    controller.request(1);
    controller.request(-1); // should be a no-op — the first tween keeps running
    controller.update(250, () => {});
    // Settled at +90 (the FIRST request's direction), not back at 0.
    expect(getViewOrientation()).toBe(90);
  });

  it("swaps the settled orientation exactly once, at the 45-degree midpoint", () => {
    const controller = new RotationController();
    const invalidate = vi.fn();
    controller.request(1);
    expect(getViewOrientation()).toBe(0); // unswapped pre-midpoint
    controller.update(100, invalidate); // 100/250 = 40% — still pre-midpoint
    expect(invalidate).not.toHaveBeenCalled();
    expect(getViewOrientation()).toBe(0);
    controller.update(30, invalidate); // 130/250 = 52% — past the midpoint
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getViewOrientation()).toBe(90);
    controller.update(120, invalidate); // finishes the tween
    expect(invalidate).toHaveBeenCalledTimes(1); // never fires twice for one tween
    expect(controller.tweening).toBe(false);
  });

  it("leans opposite-sign toward the snap, then returns to exactly 0 the instant the swap lands", () => {
    // Hand-derived (LEAN_DEG 14, easeOutQuad over the first half of the 250ms tween):
    //   p=0.4 -> leanT 0.8 -> ease 1-(0.2)^2 = 0.96 -> angle = -1 * 14 * 0.96 = -13.44deg
    // (negative for stepDir=+1: Phaser camera.rotation +theta shows the world rotated
    //  CW, while the +1 content swap rotates it CCW — the lean must preview the snap).
    const controller = new RotationController();
    controller.request(1);
    controller.update(0, () => {});
    expect(controller.cameraRotationRad()).toBeCloseTo(0);
    controller.update(100, () => {}); // progress 0.4
    expect(controller.cameraRotationRad()).toBeCloseTo((-13.44 * Math.PI) / 180, 5);
    controller.update(30, () => {}); // progress 0.52 — crosses the midpoint: SNAP
    expect(controller.cameraRotationRad()).toBe(0); // no post-swap phase at all
    expect(controller.tweening).toBe(false);
    expect(getViewOrientation()).toBe(90);
  });

  it("bearingDeg matches the settled orientation once idle", () => {
    const controller = new RotationController();
    expect(controller.bearingDeg()).toBe(0);
    controller.request(1);
    controller.update(250, () => {});
    expect(controller.bearingDeg()).toBe(270);
  });
});
