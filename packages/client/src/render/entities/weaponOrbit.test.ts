// Headless tests for the self weapon-orbit angle math: aim-source resolution (mouse vs
// facing), the slew-rate-capped sweep, orbit placement, and the strike sweep.
import { MELEE_ARC_COS, MELEE_RANGE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  MAX_ANGULAR_SPEED_RAD_PER_S,
  MELEE_HALF_ANGLE_RAD,
  ORBIT_RADIUS_TILES,
  orbitPosition,
  resolveAimAngle,
  stepOrbitAngle,
  swingSweepAngle,
} from "./weaponOrbit.js";

describe("resolveAimAngle", () => {
  it("points at the mouse, relative to the player's screen position", () => {
    expect(resolveAimAngle({ kind: "mouse", playerScreenX: 100, playerScreenY: 100, pointerScreenX: 200, pointerScreenY: 100 })).toBeCloseTo(0);
    expect(resolveAimAngle({ kind: "mouse", playerScreenX: 100, playerScreenY: 100, pointerScreenX: 100, pointerScreenY: 200 })).toBeCloseTo(Math.PI / 2);
    expect(resolveAimAngle({ kind: "mouse", playerScreenX: 100, playerScreenY: 100, pointerScreenX: 0, pointerScreenY: 100 })).toBeCloseTo(Math.PI);
  });

  it("falls back to 0 when the pointer sits exactly on the player", () => {
    expect(resolveAimAngle({ kind: "mouse", playerScreenX: 50, playerScreenY: 50, pointerScreenX: 50, pointerScreenY: 50 })).toBe(0);
  });

  it("uses held facing on touch, ignoring any mouse position entirely", () => {
    expect(resolveAimAngle({ kind: "facing", faceX: 0, faceY: 1 })).toBeCloseTo(Math.PI / 2);
    expect(resolveAimAngle({ kind: "facing", faceX: -1, faceY: 0 })).toBeCloseTo(Math.PI);
  });
});

/** Shortest signed angle from `b` to `a`, robust to wrap — used to check step *direction* without depending on stepOrbitAngle's own (-pi, pi] wrap convention. */
function shortestDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

describe("stepOrbitAngle", () => {
  it("snaps straight to target when within one tick's slew budget", () => {
    const dt = 1 / 60;
    const budget = MAX_ANGULAR_SPEED_RAD_PER_S * dt;
    expect(stepOrbitAngle(0, budget * 0.5, dt)).toBeCloseTo(budget * 0.5);
  });

  it("caps the step at MAX_ANGULAR_SPEED_RAD_PER_S * dt for a large (unambiguous-direction) jump", () => {
    const dt = 1 / 60;
    // 0.9*pi, not exactly pi, so the short way is unambiguously "increasing" (pi itself is
    // equidistant either direction and its wrap representative is an implementation detail).
    const stepped = stepOrbitAngle(0, Math.PI * 0.9, dt);
    expect(stepped).toBeCloseTo(MAX_ANGULAR_SPEED_RAD_PER_S * dt);
  });

  it("takes the short way around the wrap", () => {
    const dt = 1 / 60;
    const current = Math.PI - 0.05;
    const target = -Math.PI + 0.05; // 0.1 rad the short way past the +/-pi seam, ~6.18 rad the long way
    const stepped = stepOrbitAngle(current, target, dt);
    const traveled = shortestDelta(stepped, current);
    expect(traveled).toBeGreaterThan(0);
    expect(traveled).toBeCloseTo(Math.min(MAX_ANGULAR_SPEED_RAD_PER_S * dt, 0.1), 4);
  });

  it("converges to the target over enough ticks without overshoot", () => {
    let angle = 0;
    const target = 2.5;
    for (let i = 0; i < 60; i++) angle = stepOrbitAngle(angle, target, 1 / 60);
    expect(angle).toBeCloseTo(target, 3);
  });
});

describe("orbitPosition", () => {
  it("places the sprite ORBIT_RADIUS_TILES tiles from center along the angle, rotated outward", () => {
    const tilePx = 48;
    const pos = orbitPosition(0, 0, 0, tilePx);
    expect(pos.x).toBeCloseTo(ORBIT_RADIUS_TILES * tilePx);
    expect(pos.y).toBeCloseTo(0);
    expect(pos.rotation).toBe(0);
  });

  it("derives radius from ORBIT_RADIUS_TILES * tilePx, not a hardcoded pixel constant", () => {
    const tilePx = 48;
    const angle = Math.PI / 4;
    const pos = orbitPosition(10, 20, angle, tilePx);
    const radiusPx = ORBIT_RADIUS_TILES * tilePx;
    expect(pos.x).toBeCloseTo(10 + Math.cos(angle) * radiusPx);
    expect(pos.y).toBeCloseTo(20 + Math.sin(angle) * radiusPx);
  });
});

describe("MELEE_HALF_ANGLE_RAD", () => {
  it("is derived from the engine's MELEE_ARC_COS constant, not a magic literal", () => {
    expect(MELEE_HALF_ANGLE_RAD).toBe(Math.acos(MELEE_ARC_COS));
  });
});

describe("swingSweepAngle", () => {
  it("sweeps from baseAngle - halfAngle at progress 0 to baseAngle + halfAngle at progress 1", () => {
    const half = MELEE_HALF_ANGLE_RAD;
    expect(swingSweepAngle(0, half, 0)).toBeCloseTo(-half);
    expect(swingSweepAngle(0, half, 1)).toBeCloseTo(half);
    expect(swingSweepAngle(0, half, 0.5)).toBeCloseTo(0);
  });

  it("clamps progress outside [0,1]", () => {
    const half = MELEE_HALF_ANGLE_RAD;
    expect(swingSweepAngle(0, half, -1)).toBeCloseTo(-half);
    expect(swingSweepAngle(0, half, 2)).toBeCloseTo(half);
  });
});

// Sanity: the engine's melee range is what the wedge/orbit math is meant to communicate,
// even though this module only consumes the arc-angle constant directly.
describe("engine constant sanity", () => {
  it("MELEE_RANGE is a positive tile distance", () => {
    expect(MELEE_RANGE).toBeGreaterThan(0);
  });
});
