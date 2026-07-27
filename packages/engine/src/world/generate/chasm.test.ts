// Grafted from the "caverns" candidate: a rare deep chasm room with a
// guaranteed flat bridge deck and an infinite-height void rim
// (docs/PORT_PLAN.md's worldgen redesign brief).

import { describe, expect, it } from "vitest";
import { CHASM_DEATH_Z, TICK_DT } from "../../core/constants.js";
import { hashString } from "../../core/rng.js";
import { createBody, stepBody } from "../../entities/movement/index.js";
import { CHUNK_SIZE, TILE, TOPOLOGY } from "../types.js";
import { generateChunk } from "./index.js";
import { floodFromBorder } from "./test-support.js";
import { World } from "../world.js";

const SEED = hashString("chasm-test-world");
const FLOOR = 1;

function findChasmChunk(range: number): { cx: number; cy: number } | null {
  for (let cx = -range; cx <= range; cx++) {
    for (let cy = -range; cy <= range; cy++) {
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      for (let i = 0; i < chunk.tiles.length; i++) {
        if (chunk.tiles[i] === TILE.Void) {
          return { cx, cy };
        }
      }
    }
  }
  return null;
}

function findWalkableVoidEdge(world: World, range: number): {
  floor: { x: number; y: number };
  direction: { x: number; y: number };
} | null {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  for (let cx = -range; cx <= range; cx++) {
    for (let cy = -range; cy <= range; cy++) {
      const chunk = world.getChunk(cx, cy);
      for (let i = 0; i < chunk.tiles.length; i++) {
        const height = chunk.height[i] ?? 0;
        if (chunk.tiles[i] !== TILE.Floor || height <= CHASM_DEATH_Z) continue;
        const x = cx * CHUNK_SIZE + (i % CHUNK_SIZE);
        const y = cy * CHUNK_SIZE + Math.floor(i / CHUNK_SIZE);
        for (const direction of directions) {
          const voidX = x + direction.x;
          const voidY = y + direction.y;
          if (world.tileAt(voidX, voidY) === TILE.Void) {
            return { floor: { x, y }, direction };
          }
        }
      }
    }
  }
  return null;
}

describe("chasm rifts", () => {
  it("appear somewhere in a wide region with no lowered wall shell", () => {
    const found = findChasmChunk(24);
    expect(found, "no chasm room found in scan range").not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
    expect(Array.from(chunk.tiles)).not.toContain(TOPOLOGY.Uncarved);
  });

  it("a chasm room carries a guaranteed flat (height 0) bridge across its depth", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);

    let sawVoid = false;
    let sawBridge = false;
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] !== TILE.Floor && chunk.tiles[i] !== TILE.Void) continue;
      const h = chunk.height[i] ?? 0;
      if (chunk.tiles[i] === TILE.Void) {
        expect(h).toBe(0);
        sawVoid = true;
      }
      if (chunk.tiles[i] === TILE.Floor && Math.abs(h) < 1e-6) sawBridge = true;
    }
    expect(sawVoid).toBe(true);
    expect(sawBridge).toBe(true);
  });

  it("stays fully connected (no orphan pocket at the pit's edge)", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
    const reached = floodFromBorder(chunk.tiles);
    for (let i = 0; i < chunk.tiles.length; i++) {
      if (chunk.tiles[i] === TILE.Void) continue;
      expect(reached[i], `chunk ${found.cx},${found.cy} tile ${i} is an orphan pocket`).toBe(1);
    }
  });

  it("treats void cells as infinite-height collision boundaries", () => {
    const world = new World(SEED, FLOOR);
    const edge = findWalkableVoidEdge(world, 24);
    expect(edge, "no walkable void edge found in scan range").not.toBeNull();
    if (!edge) return;
    const body = createBody(edge.floor.x + 0.5, edge.floor.y + 0.5, world.heightAt(edge.floor.x, edge.floor.y));
    for (let tick = 0; tick < 80; tick++) {
      stepBody(world, body, {
        moveX: edge.direction.x,
        moveY: edge.direction.y,
        jump: tick === 0,
      }, TICK_DT);
    }
    expect(world.heightAt(Math.floor(body.x), Math.floor(body.y))).toBeGreaterThan(CHASM_DEATH_Z);
  });
});
