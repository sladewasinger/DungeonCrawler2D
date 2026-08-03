// Finite runtime slices are the source of truth for cross-chunk topology.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import {
  finiteFloorForRuntime,
  sliceGeneratedFloorChunk,
} from "../finiteFloor.js";
import { hashString } from "../../../core/rng.js";

const FLOOR = 1;
const SEEDS = [
  hashString("layout-test-world"),
  hashString("s2"),
  hashString("s3"),
  hashString("s4"),
  hashString("s5"),
];

describe("finite cross-chunk connectivity", () => {
  it("preserves canonical cells at every internal chunk seam", () => {
    SEEDS.forEach((worldSeed) => expectSeedSeams(worldSeed));
  }, 60_000);

  it("keeps every protected route reachable from the finite spawn", () => {
    SEEDS.forEach((worldSeed) => expectSeedRoutes(worldSeed));
  }, 60_000);
});

function expectSeedSeams(worldSeed: number): void {
  const floor = finiteFloorForRuntime({ worldSeed, floor: FLOOR });
  const xChunks = chunkRange(floor.bounds.minX, floor.bounds.maxX);
  const yChunks = chunkRange(floor.bounds.minY, floor.bounds.maxY);
  xChunks.slice(0, -1).forEach((cx) => yChunks.forEach((cy) => expectHorizontalSeam(floor, cx, cy)));
  yChunks.slice(0, -1).forEach((cy) => xChunks.forEach((cx) => expectVerticalSeam(floor, cx, cy)));
}

function expectSeedRoutes(worldSeed: number): void {
  const floor = finiteFloorForRuntime({ worldSeed, floor: FLOOR });
  const reached = reachableCells(floor);
  const routeCells = floor.routes.flat();
  expect(routeCells.length, `seed ${worldSeed} has no protected route`).toBeGreaterThan(0);
  expect(
    routeCells.every(({ x, y }) => reached.has(`${x},${y}`)),
    `seed ${worldSeed} has an unreachable route cell`,
  ).toBe(true);
}

function chunkRange(min: number, max: number): number[] {
  const first = Math.floor(min / CHUNK_SIZE);
  const last = Math.floor(max / CHUNK_SIZE);
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

function expectHorizontalSeam(
  floor: ReturnType<typeof finiteFloorForRuntime>,
  cx: number,
  cy: number,
): void {
  const left = sliceGeneratedFloorChunk(floor, cx, cy);
  const right = sliceGeneratedFloorChunk(floor, cx + 1, cy);
  for (let localY = 0; localY < CHUNK_SIZE; localY++) {
    const leftIndex = localY * CHUNK_SIZE + CHUNK_SIZE - 1;
    const rightIndex = localY * CHUNK_SIZE;
    expectChunkCell({
      floor, chunk: left, chunkIndex: leftIndex,
      x: cx * CHUNK_SIZE + CHUNK_SIZE - 1, y: cy * CHUNK_SIZE + localY,
    });
    expectChunkCell({
      floor, chunk: right, chunkIndex: rightIndex,
      x: (cx + 1) * CHUNK_SIZE, y: cy * CHUNK_SIZE + localY,
    });
  }
}

function expectVerticalSeam(
  floor: ReturnType<typeof finiteFloorForRuntime>,
  cx: number,
  cy: number,
): void {
  const north = sliceGeneratedFloorChunk(floor, cx, cy);
  const south = sliceGeneratedFloorChunk(floor, cx, cy + 1);
  for (let localX = 0; localX < CHUNK_SIZE; localX++) {
    const northIndex = (CHUNK_SIZE - 1) * CHUNK_SIZE + localX;
    const southIndex = localX;
    expectChunkCell({
      floor, chunk: north, chunkIndex: northIndex,
      x: cx * CHUNK_SIZE + localX, y: cy * CHUNK_SIZE + CHUNK_SIZE - 1,
    });
    expectChunkCell({
      floor, chunk: south, chunkIndex: southIndex,
      x: cx * CHUNK_SIZE + localX, y: (cy + 1) * CHUNK_SIZE,
    });
  }
}

function expectChunkCell(input: CanonicalCellInput): void {
  const index = (input.y - input.floor.bounds.minY) * input.floor.bounds.width +
    input.x - input.floor.bounds.minX;
  expect(input.chunk.tiles[input.chunkIndex]).toBe(input.floor.tiles[index]);
  expect(input.chunk.terrain[input.chunkIndex]).toBe(input.floor.terrain[index]);
  expect(input.chunk.height[input.chunkIndex]).toBe(input.floor.height[index]);
}

interface CanonicalCellInput {
  readonly floor: ReturnType<typeof finiteFloorForRuntime>;
  readonly chunk: ReturnType<typeof sliceGeneratedFloorChunk>;
  readonly chunkIndex: number;
  readonly x: number;
  readonly y: number;
}

function reachableCells(floor: ReturnType<typeof finiteFloorForRuntime>): Set<string> {
  const reached = new Set<string>();
  const queue = [floor.spawn];
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head];
    if (!point || !insideFloor(floor, point.x, point.y)) continue;
    const key = `${point.x},${point.y}`;
    if (reached.has(key) || isBlocked(floor, point.x, point.y)) continue;
    reached.add(key);
    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    );
  }
  return reached;
}

function insideFloor(
  floor: ReturnType<typeof finiteFloorForRuntime>,
  x: number,
  y: number,
): boolean {
  return x >= floor.bounds.minX && x <= floor.bounds.maxX &&
    y >= floor.bounds.minY && y <= floor.bounds.maxY;
}

function isBlocked(
  floor: ReturnType<typeof finiteFloorForRuntime>,
  x: number,
  y: number,
): boolean {
  const index = (y - floor.bounds.minY) * floor.bounds.width + x - floor.bounds.minX;
  const tile = floor.tiles[index];
  return tile === TILE.Void || tile === TILE.Bedrock;
}
