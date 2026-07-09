import { describe, expect, it } from "vitest";
import { STEP_UP, TICK_DT } from "../core/constants";
import { hashString } from "../core/rng";
import { createBody, stepBody } from "../entities/movement";
import { hasTerrace, terraceSpec } from "./features/terraces";
import { entryClimbDir, stairRampAt } from "./stairs";
import { CHUNK_SIZE, TILE } from "./types";
import { World } from "./world";

const SEED = hashString("test-world");
const FLOOR = 1;

function findSouthEntry(world: World): { x: number; y: number } {
  for (let cy = -6; cy <= 6; cy++) {
    for (let cx = -6; cx <= 6; cx++) {
      if (!hasTerrace(SEED, FLOOR, cx, cy)) continue;
      const spec = terraceSpec(SEED, FLOOR, cx, cy)!;
      const y = cy * CHUNK_SIZE + spec.ly + spec.hy + 1;
      for (let lx = spec.lx - spec.hx; lx <= spec.lx + spec.hx; lx++) {
        const x = cx * CHUNK_SIZE + lx;
        if (world.tileAt(x, y) !== TILE.Stairs) continue;
        if (entryClimbDir(world, x, y) !== 0) continue;
        if (world.tileAt(x, y + 1) !== TILE.Floor || world.heightAt(x, y + 1) > 0.01) continue;
        return { x, y };
      }
    }
  }
  throw new Error("no south terrace entry found in scan range");
}

describe("stairs as physical ramps", () => {
  const world = new World(SEED, FLOOR);
  const entry = findSouthEntry(world);

  it("ramps linearly across the complete two-tile stair run", () => {
    const { x, y } = entry;
    expect(stairRampAt(world, x + 0.5, y + 1.999)).toBeCloseTo(0, 2);
    expect(stairRampAt(world, x + 0.5, y + 1.75)).toBeCloseTo(0.25, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.5)).toBeCloseTo(0.5, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.25)).toBeCloseTo(0.75, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.001)).toBeCloseTo(1, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.999)).toBeCloseTo(1, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.75)).toBeCloseTo(1.25, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.5)).toBeCloseTo(1.5, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.25)).toBeCloseTo(1.75, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.001)).toBeCloseTo(2, 2);
    expect(world.groundAt(x + 0.5, y + 2.5)).toBe(0);
    expect(world.groundAt(x + 0.5, y - 0.5)).toBe(2);
  });

  it("starts climbing on the approach tile and reaches the top on foot", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 2.5, 0);
    const zs: number[] = [];
    let roseOnApproach = false;
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      zs.push(body.z);
      expect(body.grounded).toBe(true);
      if (Math.floor(body.y) === y + 1 && body.z > 0) roseOnApproach = true;
    }
    expect(body.z).toBeCloseTo(2, 5);
    expect(roseOnApproach).toBe(true);
    expect(zs.some((z) => z > 0.2 && z < 0.8)).toBe(true);
    expect(zs.some((z) => z > 1.2 && z < 1.8)).toBe(true);
    for (let i = 1; i < zs.length; i++) {
      expect(zs[i]! - zs[i - 1]!).toBeLessThan(STEP_UP * 0.9);
    }
  });

  it("falls from partial height when leaving the stair's side", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 2.5, 0);
    for (let i = 0; i < 30 && body.z < 0.4; i++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
    }
    expect(body.z).toBeGreaterThan(0.2);
    expect(body.z).toBeLessThan(2);
    const sideOpen =
      world.tileAt(x + 1, Math.floor(body.y)) === TILE.Floor &&
      world.heightAt(x + 1, Math.floor(body.y)) < body.z;
    const dir = sideOpen ? 1 : -1;
    let fell: number | null = null;
    for (let i = 0; i < 60 && fell === null; i++) {
      const r = stepBody(world, body, { moveX: dir, moveY: 0, jump: false }, TICK_DT);
      if (r.landed) fell = r.landed.fallHeight;
    }
    if (fell !== null) expect(fell).toBeLessThan(2);
    expect(body.z).toBeCloseTo(world.groundAt(body.x, body.y), 5);
  });
});
