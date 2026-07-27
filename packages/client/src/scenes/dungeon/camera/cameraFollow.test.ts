import { describe, expect, it } from "vitest";
import { createCameraFollowState, requestCameraSnap, stepCameraFollow } from "./cameraFollow.js";

describe("stepCameraFollow", () => {
  it("snaps straight to target on the first step (state starts snapped)", () => {
    const state = createCameraFollowState();
    stepCameraFollow(state, { targetX: 100, targetY: 200, deltaMs: 16 });
    expect(state).toMatchObject({ x: 100, y: 200, snap: false });
  });

  it("eases partway toward target on subsequent steps, never overshooting", () => {
    const state = createCameraFollowState();
    stepCameraFollow(state, { targetX: 0, targetY: 0, deltaMs: 16 });
    stepCameraFollow(state, { targetX: 100, targetY: 0, deltaMs: 16 });
    expect(state.x).toBeGreaterThan(0);
    expect(state.x).toBeLessThan(100);
  });

  it("converges to the target over many small steps", () => {
    const state = createCameraFollowState();
    stepCameraFollow(state, { targetX: 0, targetY: 0, deltaMs: 16 });
    for (let i = 0; i < 300; i++) stepCameraFollow(state, { targetX: 500, targetY: -300, deltaMs: 16 });
    expect(state.x).toBeCloseTo(500, 0);
    expect(state.y).toBeCloseTo(-300, 0);
  });

  it("requestCameraSnap forces the next step to jump instantly regardless of distance", () => {
    const state = createCameraFollowState();
    stepCameraFollow(state, { targetX: 0, targetY: 0, deltaMs: 16 });
    stepCameraFollow(state, { targetX: 10, targetY: 10, deltaMs: 16 });
    requestCameraSnap(state);
    stepCameraFollow(state, { targetX: 9999, targetY: -9999, deltaMs: 16 });
    expect(state).toMatchObject({ x: 9999, y: -9999, snap: false });
  });
});
