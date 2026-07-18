import { describe, expect, it } from "vitest";
import { STEP_UP, TICK_DT } from "../core/constants.js";
import { hashString } from "../core/rng.js";
import { createBody, stepBody } from "../entities/movement/index.js";
import { hasTerrace, terraceSpec } from "./features/terraces.js";
import { entryClimbDir, stairRampAt, type StairView } from "./stairs.js";
import { CHUNK_SIZE, TILE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

function findSouthEntry(world: World): { x: number; y: number } {
  for (let cy = -6; cy <= 6; cy++) {
    for (let cx = -6; cx <= 6; cx++) {
      if (!hasTerrace(SEED, FLOOR, cx, cy)) continue;
      const spec = terraceSpec(SEED, FLOOR, cx, cy);
      if (!spec) continue;
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

  it("ramps linearly across the complete two-and-a-half-tile stair run", () => {
    const { x, y } = entry;
    expect(stairRampAt(world, x + 0.5, y + 2.499)).toBeCloseTo(0, 2);
    expect(stairRampAt(world, x + 0.5, y + 2.25)).toBeCloseTo(0.2, 5);
    expect(stairRampAt(world, x + 0.5, y + 2)).toBeCloseTo(0.4, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.5)).toBeCloseTo(0.8, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.25)).toBeCloseTo(1, 5);
    expect(stairRampAt(world, x + 0.5, y + 1.001)).toBeCloseTo(1.2, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.999)).toBeCloseTo(1.2, 2);
    expect(stairRampAt(world, x + 0.5, y + 0.75)).toBeCloseTo(1.4, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.5)).toBeCloseTo(1.6, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.25)).toBeCloseTo(1.8, 5);
    expect(stairRampAt(world, x + 0.5, y + 0.001)).toBeCloseTo(2, 2);
    expect(world.groundAt(x + 0.5, y + 3.5)).toBe(0);
    expect(world.groundAt(x + 0.5, y - 0.5)).toBe(2);
  });

  it("starts climbing on the outer approach tile and reaches the top on foot", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
    const zs: number[] = [];
    let roseOnOuterApproach = false;
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      zs.push(body.z);
      expect(body.grounded).toBe(true);
      if (Math.floor(body.y) === y + 2 && body.z > 0) roseOnOuterApproach = true;
    }
    expect(body.z).toBeCloseTo(2, 5);
    expect(roseOnOuterApproach).toBe(true);
    expect(zs.some((z) => z > 0.2 && z < 0.8)).toBe(true);
    expect(zs.some((z) => z > 1.2 && z < 1.8)).toBe(true);
    for (let i = 1; i < zs.length; i++) {
      const prev = zs[i - 1];
      const cur = zs[i];
      if (prev === undefined || cur === undefined) continue;
      expect(cur - prev).toBeLessThan(STEP_UP * 0.9);
    }
  });

  it("falls from partial height when leaving the stair's side", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 3.5, 0);
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

  it("descends the same run entering from the high end, with no airborne flicker", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y - 1.5, 2);
    let flicker = 0;
    for (let i = 0; i < 30; i++) {
      stepBody(world, body, { moveX: 0, moveY: 1, jump: false }, TICK_DT);
      if (!body.grounded) flicker++;
    }
    expect(flicker).toBe(0);
    expect(body.z).toBeCloseTo(0, 5);
  });

  it("lands correctly when falling onto the ramp mid-descent while moving across it", () => {
    const { x, y } = entry;
    const body = createBody(x + 0.5, y + 2.499, 6);
    let landings = 0;
    let landedZ = -1;
    // Stop at the first landing: further travel walks off the terrace's
    // far (unramped, by design) edge into a second, unrelated fall.
    for (let i = 0; i < 80 && landings === 0; i++) {
      const r = stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
      if (r.landed) {
        landings++;
        landedZ = body.z;
      }
    }
    expect(landings).toBe(1); // one clean landing, no double-land off the ramp
    expect(landedZ).toBeCloseTo(world.groundAt(body.x, body.y), 4);
  });
});

describe("stair width: walking across a run sideways", () => {
  /** Mimics terraces.ts's 2-wide south entry: stair columns 10-11 at row
   * y=10 (height 1), raised interior north of it (y<10, height 2), flat
   * approach south of it (y>10, height 0). Flanking columns 9 and 12 are
   * plain floor at whatever height their row implies (no ramp). */
  function twoWideSouthEntry(): StairView {
    const stairCols = new Set([10, 11]);
    return {
      tileAt: (wx, wy) => (wy === 10 && stairCols.has(wx) ? TILE.Stairs : TILE.Floor),
      heightAt: (wx, wy) => {
        if (wy === 10 && stairCols.has(wx)) return 1;
        return wy < 10 ? 2 : 0;
      },
    };
  }

  it("both columns of a 2-wide run ramp identically at the same row", () => {
    const view = twoWideSouthEntry();
    for (const y of [10.9, 10.5, 10.1]) {
      expect(stairRampAt(view, 10.5, y)).toBeCloseTo(stairRampAt(view, 11.5, y) ?? NaN, 5);
    }
  });

  it("reads flat immediately beside the run's own width, not ramped", () => {
    const view = twoWideSouthEntry();
    expect(stairRampAt(view, 9.5, 10.5)).toBeNull();
    expect(stairRampAt(view, 12.5, 10.5)).toBeNull();
  });

  it("stepping sideways off the ramp onto the flanking approach never leaves the ground", () => {
    const view = twoWideSouthEntry();
    const groundAt = (x: number, y: number): number => stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
    const world = { isWalkable: () => true, heightAt: view.heightAt, groundAt };
    const body = createBody(9.5, 10.9, groundAt(9.5, 10.9));
    let flicker = 0;
    for (let i = 0; i < 40; i++) {
      stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
      if (!body.grounded) flicker++;
    }
    expect(flicker).toBe(0);
  });
});
