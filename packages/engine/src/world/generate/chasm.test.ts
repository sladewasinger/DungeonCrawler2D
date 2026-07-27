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
const DIRECTIONS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

function chunkCoordinates(range: number): Array<{ cx: number; cy: number }> {
  const width = range * 2 + 1;
  return Array.from({ length: width ** 2 }, (_, index) => ({ cx: index % width - range, cy: Math.floor(index / width) - range }));
}

function chunkHasVoid(coordinate: { cx: number; cy: number }): boolean {
  return generateChunk({ worldSeed: SEED, floor: FLOOR, ...coordinate }).tiles.some((tile) => tile === TILE.Void);
}

function findChasmChunk(range: number): { cx: number; cy: number } | null {
  return chunkCoordinates(range).find(chunkHasVoid) ?? null;
}

function worldCells(world: World, range: number): Array<{ x: number; y: number; tile: number; height: number }> {
  return chunkCoordinates(range).flatMap(({ cx, cy }) => {
    const chunk = world.getChunk(cx, cy);
    return Array.from(chunk.tiles, (tile, index) => ({ x: cx * CHUNK_SIZE + index % CHUNK_SIZE, y: cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE), tile, height: chunk.height[index] ?? 0 }));
  });
}

function voidDirection(world: World, floor: { x: number; y: number }): { x: number; y: number } | null {
  return DIRECTIONS.find(({ x, y }) => world.tileAt(floor.x + x, floor.y + y) === TILE.Void) ?? null;
}

function findWalkableVoidEdge(world: World, range: number): {
  floor: { x: number; y: number };
  direction: { x: number; y: number };
} | null {
  const floor = worldCells(world, range).find((cell) => cell.tile === TILE.Floor && cell.height > CHASM_DEATH_Z && voidDirection(world, cell));
  if (!floor) return null;
  const direction = voidDirection(world, floor);
  return direction ? { floor, direction } : null;
}

function chasmContents(chunk: ReturnType<typeof generateChunk>): { sawVoid: boolean; sawBridge: boolean } {
  return Array.from(chunk.tiles).reduce<{ sawVoid: boolean; sawBridge: boolean }>((found, tile, index) => ({
    sawVoid: found.sawVoid || tile === TILE.Void,
    sawBridge: found.sawBridge || (tile === TILE.Floor && Math.abs(chunk.height[index] ?? 0) < 1e-6),
  }), { sawVoid: false, sawBridge: false });
}

describe("chasm rifts", () => {
  it("appear somewhere in a wide region with no lowered wall shell", () => {
    const found = findChasmChunk(24);
    expect(found, "no chasm room found in scan range").not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    expect(Array.from(chunk.tiles)).not.toContain(TOPOLOGY.Uncarved);
  });

  it("a chasm room carries a guaranteed flat (height 0) bridge across its depth", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });

    const { sawVoid, sawBridge } = chasmContents(chunk);
    for (const [index, tile] of Array.from(chunk.tiles).entries()) if (tile === TILE.Void) expect(chunk.height[index]).toBe(0);
    expect(sawVoid).toBe(true);
    expect(sawBridge).toBe(true);
  });

  it("stays fully connected (no orphan pocket at the pit's edge)", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
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
