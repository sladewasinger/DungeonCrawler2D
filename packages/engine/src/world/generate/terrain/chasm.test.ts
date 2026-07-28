// Grafted from the "caverns" candidate: a rare deep chasm room with a
// guaranteed flat bridge deck and an infinite-height void rim
// (docs/PORT_PLAN.md's worldgen redesign brief).

import { describe, expect, it } from "vitest";
import { CHASM_DEATH_Z, TICK_DT } from "../../../core/constants.js";
import { hashString } from "../../../core/rng.js";
import { createBody, stepBody } from "../../../entities/movement/index.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { generateChunk } from "../index.js";
import { floodFromBorder } from "../test-support.js";
import { World } from "../../core/world.js";

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

describe("chasm rifts", () => {
  it("a chasm room carries a guaranteed flat (height 0) bridge across its depth", () => {
    const found = findChasmChunk(24);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });

    const sawVoid = Array.from(chunk.tiles).some((tile) => tile === TILE.Void);
    for (const [index, tile] of Array.from(chunk.tiles).entries()) if (tile === TILE.Void) expect(chunk.height[index]).toBe(0);
    expect(sawVoid).toBe(true);
    expect(hasFlatBridge(chunk)).toBe(true);
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
    const bodyTile = { x: Math.floor(body.x), y: Math.floor(body.y) };
    expect(world.tileAt(bodyTile.x, bodyTile.y)).not.toBe(TILE.Void);
    expect(world.isWalkable(bodyTile.x, bodyTile.y)).toBe(true);
  }, 15_000);
});

function hasFlatBridge(chunk: ReturnType<typeof generateChunk>): boolean {
  return hasHorizontalBridge(chunk) || hasVerticalBridge(chunk);
}

function hasHorizontalBridge(chunk: ReturnType<typeof generateChunk>): boolean {
  for (let y = 1; y < CHUNK_SIZE - 1; y++) {
    if (hasEnclosedFlatRun({ chunk, fixed: y, vertical: false })) return true;
  }
  return false;
}

function hasVerticalBridge(chunk: ReturnType<typeof generateChunk>): boolean {
  for (let x = 1; x < CHUNK_SIZE - 1; x++) {
    if (hasEnclosedFlatRun({ chunk, fixed: x, vertical: true })) return true;
  }
  return false;
}

interface BridgeScan {
  readonly chunk: ReturnType<typeof generateChunk>;
  readonly fixed: number;
  readonly vertical: boolean;
}

function hasEnclosedFlatRun(input: BridgeScan): boolean {
  for (let variable = 1; variable < CHUNK_SIZE - 1; variable++) {
    if (!isFlatFloor(input, variable)) continue;
    const end = flatRunEnd(input, variable);
    if (isEnclosedLongRun(input, variable, end)) return true;
    variable = end;
  }
  return false;
}

function isEnclosedLongRun(input: BridgeScan, start: number, end: number): boolean {
  return end - start + 1 >= 4 && isVoid(input, start - 1) && isVoid(input, end + 1);
}

function flatRunEnd(input: BridgeScan, start: number): number {
  let end = start;
  while (end + 1 < CHUNK_SIZE && isFlatFloor(input, end + 1)) end++;
  return end;
}

function isFlatFloor(input: BridgeScan, variable: number): boolean {
  const index = input.vertical ? variable * CHUNK_SIZE + input.fixed : input.fixed * CHUNK_SIZE + variable;
  return input.chunk.tiles[index] === TILE.Floor && Math.abs(input.chunk.height[index] ?? 0) <= 1e-6;
}

function isVoid(input: BridgeScan, variable: number): boolean {
  const index = input.vertical ? variable * CHUNK_SIZE + input.fixed : input.fixed * CHUNK_SIZE + variable;
  return input.chunk.tiles[index] === TILE.Void;
}
