import { describe, expect, it } from "vitest";
import { MAX_THROW_RANGE } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { makeEntity } from "./entity.js";
import { createBody } from "./movement/index.js";
import { launchTorch, stepTorch } from "./torch.js";

/** Flat, fully open ground — every tile walkable, height 0. */
function flatWorld(): WorldView {
  return { isWalkable: () => true, heightAt: () => 0, groundAt: () => 0 };
}

/** A solid (furniture) tile at (3, 0): blocks a flight path aimed east. */
function wallAt3World(): WorldView {
  return {
    isWalkable: (x, y) => !(x === 3 && y === 0),
    heightAt: () => 0,
    groundAt: () => 0,
  };
}

function flyingTorch(vel: { x: number; y: number; z: number }) {
  const body = createBody(0.5, 0.5, 1);
  body.grounded = false;
  return makeEntity("torch", body, { torchState: "flying", vel });
}

describe("launchTorch", () => {
  it("normalizes the aim direction and arcs toward a point MAX_THROW_RANGE away", () => {
    const { vel } = launchTorch(flatWorld(), { x: 0, y: 0, z: 1 }, 3, 4); // 3-4-5 triangle
    expect(Math.hypot(vel.x, vel.y)).toBeGreaterThan(0);
    // Direction preserved: vel.x/vel.y ratio matches the normalized (3/5, 4/5) input.
    expect(vel.x / vel.y).toBeCloseTo(3 / 4, 5);
    expect(vel.z).toBeGreaterThan(0); // launched upward, not straight-lined
  });

  it("defaults a zero-length vector to a sane forward throw instead of nowhere", () => {
    const { vel } = launchTorch(flatWorld(), { x: 0, y: 0, z: 1 }, 0, 0);
    expect(Math.hypot(vel.x, vel.y)).toBeGreaterThan(0);
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

  it("arcs, lands on open ground, snaps to the landing tile's center, and flips to placed", () => {
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
    expect(torch.body.x % 1).toBeCloseTo(0.5, 5);
    expect(torch.body.y % 1).toBeCloseTo(0.5, 5);
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

  it("launched torch flight reaches roughly the intended MAX_THROW_RANGE distance", () => {
    const from = { x: 0.5, y: 0.5, z: 0 };
    const { vel } = launchTorch(flatWorld(), from, 1, 0);
    const torch = makeEntity("torch", createBody(from.x, from.y, from.z), {
      torchState: "flying",
      vel,
    });
    torch.body.grounded = false;
    let result = stepTorch(flatWorld(), torch, 0.02);
    let steps = 0;
    while (!result.landed && steps < 500) {
      result = stepTorch(flatWorld(), torch, 0.02);
      steps++;
    }
    expect(result.landed).toBe(true);
    expect(torch.body.x - from.x).toBeCloseTo(MAX_THROW_RANGE, 0);
  });
});
