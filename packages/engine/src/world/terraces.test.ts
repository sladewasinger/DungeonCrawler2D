import { describe, expect, it } from "vitest";
import { STEP_UP } from "../core/constants";
import { hashString } from "../core/rng";
import { hasPlatformCluster } from "./platforms";
import { TERRACE_RISE, hasTerrace, terraceSpec } from "./terraces";
import { chunkCenter } from "./terrain";
import { CHUNK_SIZE, TILE } from "./types";
import { World } from "./world";

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
    const [cx, cy] = findTerraces(6)[0]!;
    const spec = terraceSpec(SEED, FLOOR, cx, cy)!;
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    // The interior is a flat raised district.
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
    expect(raisedFloors).toBeGreaterThan(40);

    // Stairs: only on the boundary ring, at the halfway step.
    let stairs = 0;
    let linked = 0;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = baseX + lx;
        const y = baseY + ly;
        if (world.tileAt(x, y) !== TILE.Stairs) continue;
        stairs++;
        expect(world.heightAt(x, y)).toBe(TERRACE_RISE / 2);
        const onRing =
          Math.abs(lx - spec.lx) === spec.hx || Math.abs(ly - spec.ly) === spec.hy;
        expect(onRing).toBe(true);
        // Does this entry step actually link low ground to the top?
        let low = false;
        let high = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          if (world.tileAt(x + dx, y + dy) === TILE.Wall) continue;
          const nh = world.heightAt(x + dx, y + dy);
          if (nh <= 0.01) low = true;
          if (Math.abs(nh - TERRACE_RISE) < 0.01) high = true;
        }
        if (low && high) linked++;
      }
    }
    expect(stairs).toBeGreaterThanOrEqual(2); // the corridor enters and leaves
    expect(linked).toBeGreaterThanOrEqual(1); // at least one true entry step
  });

  it("the junction atop the section is reachable on foot from the neighbor chunk", () => {
    const world = new World(SEED, FLOOR);
    const [cx, cy] = findTerraces(6)[0]!;
    const start = snapCenter(world, cx - 1, cy);
    const target = snapCenter(world, cx, cy);
    // The junction sits inside the terrace, so this walk must climb it.
    expect(world.heightAt(target.x, target.y)).toBeGreaterThanOrEqual(TERRACE_RISE - 0.01);

    const minX = (cx - 1) * CHUNK_SIZE;
    const maxX = (cx + 1) * CHUNK_SIZE + CHUNK_SIZE - 1;
    const minY = (cy - 1) * CHUNK_SIZE;
    const maxY = (cy + 1) * CHUNK_SIZE + CHUNK_SIZE - 1;
    const reached = new Set<string>([`${start.x},${start.y}`]);
    const queue = [start];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++]!;
      const curH = world.heightAt(cur.x, cur.y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < minX || ny < minY || nx > maxX || ny > maxY) continue;
        const key = `${nx},${ny}`;
        if (reached.has(key) || !world.isWalkable(nx, ny)) continue;
        if (world.tileAt(nx, ny) === TILE.Wall) continue; // walking, not jumping
        if (world.heightAt(nx, ny) - curH > STEP_UP) continue;
        reached.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
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
