import { describe, expect, it } from "vitest";
import { STEP_UP } from "../../core/constants.js";
import { hashString } from "../../core/rng.js";
import { hasPlatformCluster } from "./platforms.js";
import { TERRACE_RISE, hasTerrace, terraceSpec } from "./terraces.js";
import { chunkCenter } from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { World } from "../world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

function findTerraces(range: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cy = -range; cy <= range; cy++) {
    for (let cx = -range; cx <= range; cx++) {
      if (hasTerrace(SEED, FLOOR, cx, cy)) out.push([cx, cy]);
    }
  }
  return out;
}

describe("raised sections (terraces)", () => {
  it("appear at a meaningful rate and never share a chunk with platform clusters", () => {
    const terraces = findTerraces(6); // 13×13 chunks
    expect(terraces.length).toBeGreaterThan(8);
    for (const [cx, cy] of terraces) {
      expect(hasPlatformCluster(SEED, FLOOR, cx, cy)).toBe(false);
    }
  });

  it("raises a hard-edged district one level, with stair entries only on the corridor", () => {
    const world = new World(SEED, FLOOR);
    const first = findTerraces(6)[0];
    if (!first) throw new Error("no terrace found in scan range");
    const [cx, cy] = first;
    const spec = terraceSpec(SEED, FLOOR, cx, cy);
    if (!spec) throw new Error("terraceSpec returned null for a hasTerrace chunk");
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    const raisedFloors = countRaisedFloors(world, spec, baseX, baseY);
    expect(raisedFloors).toBeGreaterThan(40);

    // Entry steps: one tile OUTSIDE the boundary (the rect's outline
    // stays unbroken; the staircase object leans against it) — and
    // NEVER on the north side (no north→south-climbing staircase
    // exists in the pack; north edges are drop-off ledges).
    const { stairs, linked } = checkStairEntries(world, spec, baseX, baseY);
    expect(stairs).toBeGreaterThanOrEqual(2); // the corridor enters and leaves
    expect(linked).toBeGreaterThanOrEqual(1); // at least one true entry step
  });

  it("the junction atop the section is reachable on foot from the neighbor chunk", () => {
    const world = new World(SEED, FLOOR);
    const first = findTerraces(6)[0];
    if (!first) throw new Error("no terrace found in scan range");
    const [cx, cy] = first;
    const start = snapCenter(world, cx - 1, cy);
    const target = snapCenter(world, cx, cy);
    // The junction sits inside the terrace, so this walk must climb it.
    expect(world.heightAt(target.x, target.y)).toBeGreaterThanOrEqual(TERRACE_RISE - 0.01);

    const bounds: WalkBounds = {
      minX: (cx - 1) * CHUNK_SIZE,
      maxX: (cx + 1) * CHUNK_SIZE + CHUNK_SIZE - 1,
      minY: (cy - 1) * CHUNK_SIZE,
      maxY: (cy + 1) * CHUNK_SIZE + CHUNK_SIZE - 1,
    };
    const reached = walkableReachable(world, start, bounds);
    expect(reached.has(`${target.x},${target.y}`)).toBe(true);
  });
});

function snapCenter(world: World, cx: number, cy: number): { x: number; y: number } {
  const c = chunkCenter(world.worldSeed, world.floor, cx, cy);
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(c.x) + dx;
        const y = Math.round(c.y) + dy;
        if (world.isWalkable(x, y) && world.tileAt(x, y) !== TILE.Wall) return { x, y };
      }
    }
  }
  throw new Error(`no walkable tile near center of ${cx},${cy}`);
}

/** Count of raised-district floor tiles at TERRACE_RISE inside spec's rect (asserts as it counts). */
function countRaisedFloors(
  world: World,
  spec: { lx: number; ly: number; hx: number; hy: number },
  baseX: number,
  baseY: number,
): number {
  let raisedFloors = 0;
  for (let dy = -spec.hy + 1; dy <= spec.hy - 1; dy++) {
    for (let dx = -spec.hx + 1; dx <= spec.hx - 1; dx++) {
      const x = baseX + spec.lx + dx;
      const y = baseY + spec.ly + dy;
      if (world.tileAt(x, y) !== TILE.Floor) continue;
      expect(world.heightAt(x, y)).toBe(TERRACE_RISE);
      raisedFloors++;
    }
  }
  return raisedFloors;
}

/** Whether a stair tile at (x, y) touches both a low tile and the terrace top. */
function isLinkedEntry(world: World, x: number, y: number): boolean {
  let low = false;
  let high = false;
  for (const [ddx, ddy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (world.tileAt(x + ddx, y + ddy) === TILE.Wall) continue;
    const nh = world.heightAt(x + ddx, y + ddy);
    if (nh <= 0.01) low = true;
    if (Math.abs(nh - TERRACE_RISE) < 0.01) high = true;
  }
  return low && high;
}

/** Asserts every stair tile is a valid boundary entry step; returns counts. */
function checkStairEntries(
  world: World,
  spec: { lx: number; ly: number; hx: number; hy: number },
  baseX: number,
  baseY: number,
): { stairs: number; linked: number } {
  let stairs = 0;
  let linked = 0;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = baseX + lx;
      const y = baseY + ly;
      if (world.tileAt(x, y) !== TILE.Stairs) continue;
      stairs++;
      expect(world.heightAt(x, y)).toBe(TERRACE_RISE / 2);
      const dx = Math.abs(lx - spec.lx);
      const dy = ly - spec.ly;
      const outsideEdge =
        (dx === spec.hx + 1 && Math.abs(dy) < spec.hy) || // east/west
        (dy === spec.hy + 1 && dx < spec.hx); // south
      expect(outsideEdge, `step at ${lx},${ly} hugs an entry edge`).toBe(true);
      expect(dy, "no steps on the north side").not.toBe(-(spec.hy + 1));
      if (isLinkedEntry(world, x, y)) linked++;
    }
  }
  return { stairs, linked };
}

interface WalkBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Whether (nx, ny) is a valid walking step from height curH (no wall-hop, rise capped). */
function canWalkOnto(world: World, bounds: WalkBounds, curH: number, nx: number, ny: number): boolean {
  if (nx < bounds.minX || ny < bounds.minY || nx > bounds.maxX || ny > bounds.maxY) return false;
  if (!world.isWalkable(nx, ny)) return false;
  if (world.tileAt(nx, ny) === TILE.Wall) return false; // walking, not jumping
  return world.heightAt(nx, ny) - curH <= STEP_UP;
}

function walkableReachable(
  world: World,
  start: { x: number; y: number },
  bounds: WalkBounds,
): Set<string> {
  const reached = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (!cur) continue;
    const curH = world.heightAt(cur.x, cur.y);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (reached.has(key) || !canWalkOnto(world, bounds, curH, nx, ny)) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}
