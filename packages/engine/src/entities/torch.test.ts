import { describe, expect, it } from "vitest";
import type { WorldView } from "../world/core/types.js";
import { TICK_DT } from "../core/constants.js";
import { makeEntity } from "./entity.js";
import { createBody } from "./movement/index.js";
import { launchTorch, stepTorch } from "./torch.js";

/** Flat, fully open ground — every tile walkable, height 0. */
function flatWorld(): WorldView {
  return { isWalkable: () => true, heightAt: () => 0, groundAt: () => 0, stairHeightAt: () => null };
}

/** A solid (furniture) tile at (3, 0): blocks a flight path aimed east. */
function wallAt3World(): WorldView {
  return {
    isWalkable: (x, y) => !(x === 3 && y === 0),
    heightAt: () => 0,
    groundAt: () => 0,
    stairHeightAt: () => null,
  };
}

function raisedTargetWorld(): WorldView {
  return {
    isWalkable: () => true,
    heightAt: (x, y) => (Math.floor(x) === 2 && Math.floor(y) === 0 ? 2 : 0),
    groundAt: (x, y) => (Math.floor(x) === 2 && Math.floor(y) === 0 ? 2 : 0),
    stairHeightAt: () => null,
  };
}

function flyingTorch(vel: { x: number; y: number; z: number }) {
  const body = createBody(0.5, 0.5, 1);
  body.grounded = false;
  return makeEntity("torch", body, { torchState: "flying", vel });
}

describe("launchTorch", () => {
  it("arcs toward the requested target", () => {
    const { vel } = launchTorch({
      world: flatWorld(),
      from: { x: 0, y: 0, z: 1 },
      target: { x: 3, y: 4 },
    });
    expect(Math.hypot(vel.x, vel.y)).toBeGreaterThan(0);
    expect(vel.x / vel.y).toBeCloseTo(3 / 4, 5);
    expect(vel.z).toBeGreaterThan(0);
  });

  it("does not invent distance for a target at the thrower's position", () => {
    const { vel } = launchTorch({
      world: flatWorld(),
      from: { x: 0, y: 0, z: 1 },
      target: { x: 0, y: 0 },
    });
    expect(Math.hypot(vel.x, vel.y)).toBe(0);
  });
});

describe("stepTorch", () => {
  it("is a no-op once already placed", () => {
    const torch = flyingTorch({ x: 10, y: 0, z: 0 });
    torch.torchState = "placed";
    const before = { ...torch.body };
    expect(stepTorch(flatWorld(), torch, 0.1)).toEqual({});
    expect(torch.body).toEqual(before);
  });

  it("arcs, lands on open ground, preserves the impact point, and flips to placed", () => {
    const torch = flyingTorch({ x: 10, y: 0, z: 2 });
    let result = stepTorch(flatWorld(), torch, 0.1);
    let steps = 0;
    while (!result.landed && steps < 50) {
      result = stepTorch(flatWorld(), torch, 0.1);
      steps++;
    }
    expect(result.landed).toBe(true);
    expect(torch.torchState).toBe("placed");
    expect(torch.vel).toBeUndefined();
    expect(torch.body.x).not.toBeCloseTo(0.5, 5);
    expect(torch.body.y).toBeCloseTo(0.5, 5);
  });

  it("stops and places at the wall (visual-height blocking rule), never crossing it", () => {
    // 1 tile/tick horizontally, arcing down slowly — reaches the tile-3
    // wall in 3 steps, well before gravity would land it on open ground.
    const body = createBody(0.5, 0.5, 5);
    body.grounded = false;
    const torch = makeEntity("torch", body, { torchState: "flying", vel: { x: 10, y: 0, z: 0 } });
    let result = stepTorch(wallAt3World(), torch, 0.1);
    let steps = 0;
    while (!result.landed && steps < 50) {
      result = stepTorch(wallAt3World(), torch, 0.1);
      steps++;
    }
    expect(result.landed).toBe(true);
    expect(torch.torchState).toBe("placed");
    expect(torch.body.x).toBeLessThan(3);
  });

  it("lands a near throw at its exact target with production 50ms ticks", () => {
    const from = { x: 0.5, y: 0.5, z: 0 };
    const target = { x: 2.25, y: 0.5 };
    const launch = launchTorch({ world: flatWorld(), from, target });
    const torch = makeEntity("torch", createBody(from.x, from.y, from.z), {
      torchState: "flying",
      vel: launch.vel,
      ballisticFlight: launch.ballisticFlight,
    });
    torch.body.grounded = false;
    let result = stepTorch(flatWorld(), torch, TICK_DT);
    let steps = 0;
    while (!result.landed && steps < 40) {
      result = stepTorch(flatWorld(), torch, TICK_DT);
      steps++;
    }
    expect(result.landed).toBe(true);
    expect(torch.body.x).toBeCloseTo(target.x, 8);
    expect(torch.body.y).toBeCloseTo(target.y, 8);
    expect(torch.body.x).not.toBeCloseTo(2.5, 2);
    expect(torch.body.x - from.x).toBeLessThan(3);
  });

  it("lands on the target ground height when the target is elevated", () => {
    const from = { x: 0.5, y: 0.5, z: 0 };
    const launch = launchTorch({
      world: raisedTargetWorld(),
      from,
      target: { x: 2.25, y: 0.5 },
    });
    const torch = makeEntity("torch", createBody(from.x, from.y, from.z), {
      torchState: "flying",
      vel: launch.vel,
      ballisticFlight: launch.ballisticFlight,
    });
    torch.body.grounded = false;
    let result = stepTorch(raisedTargetWorld(), torch, 0.02);
    let steps = 0;
    while (!result.landed && steps < 500) {
      result = stepTorch(raisedTargetWorld(), torch, 0.02);
      steps++;
    }

    expect(result.landed).toBe(true);
    expect(torch.body.z).toBe(2);
  });
});
