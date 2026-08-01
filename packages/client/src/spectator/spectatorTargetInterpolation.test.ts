import { describe, expect, it } from "vitest";
import { SpectatorTargetInterpolation } from "./spectatorTargetInterpolation.js";

const world = {};

describe("SpectatorTargetInterpolation", () => {
  it("smooths target motion on the authoritative snapshot timeline", () => {
    const interpolation = new SpectatorTargetInterpolation();
    interpolation.update(input({ tick: 1, x: 0, renderAtMs: 50 }));
    interpolation.update(input({ tick: 2, x: 10, renderAtMs: 100 }));
    const pose = interpolation.update(input({ tick: 3, x: 20, renderAtMs: 125 }));
    expect(pose.x).toBeCloseTo(15);
  });

  it("interpolates across buffered history when snapshot cadence has a gap", () => {
    const interpolation = new SpectatorTargetInterpolation();
    interpolation.update(input({ tick: 1, x: 0, renderAtMs: 50 }));
    interpolation.update(input({ tick: 2, x: 10, renderAtMs: 100 }));
    const pose = interpolation.update(input({
      tick: 5,
      x: 40,
      renderAtMs: 250,
      delayMs: 125,
    }));
    expect(pose.x).toBeCloseTo(15);
  });

  it("hard-resets when the target or world changes", () => {
    const interpolation = new SpectatorTargetInterpolation();
    interpolation.update(input({ tick: 1, x: 0, renderAtMs: 50 }));
    interpolation.update(input({ tick: 2, x: 10, renderAtMs: 100 }));
    const targetReset = interpolation.update(input({
      tick: 3,
      x: 80,
      renderAtMs: 150,
      targetId: "p2",
    }));
    expect(targetReset.x).toBe(80);
    const worldReset = interpolation.update(input({
      tick: 4,
      x: -30,
      renderAtMs: 200,
      targetId: "p2",
      targetWorld: {},
    }));
    expect(worldReset.x).toBe(-30);
  });

  it("hard-resets a teleported target", () => {
    const interpolation = new SpectatorTargetInterpolation();
    interpolation.update(input({ tick: 1, x: 0, renderAtMs: 50 }));
    const pose = interpolation.update(input({
      tick: 2,
      x: 100,
      renderAtMs: 100,
      reset: true,
    }));
    expect(pose.x).toBe(100);
  });
});

interface TestInput {
  readonly tick: number;
  readonly x: number;
  readonly renderAtMs: number;
  readonly targetId?: string;
  readonly targetWorld?: object;
  readonly reset?: boolean;
  readonly delayMs?: number;
}

function input(test: TestInput) {
  return {
    pose: { x: test.x, y: 0, z: 0 },
    tick: test.tick,
    renderAtMs: test.renderAtMs,
    delayMs: test.delayMs ?? 0,
    targetId: test.targetId ?? "p1",
    world: test.targetWorld ?? world,
    ...(test.reset === undefined ? {} : { reset: test.reset }),
  };
}
