// The kiosk door is a wall feature over an intact z2 terrace cell. Its front
// approach must still connect to the wider corridor network.
//
// One fixed seed keeps this deterministic and fast: every seed exercises the
// same stamping code, so sweeping many full floors only multiplied runtime
// (and timed out the release gate) without adding coverage.
import { describe, expect, it } from "vitest";
import { isSafeRoomChunk } from "../../features/fixed/fixed.js";
import { CHUNK_SIZE, FEATURE_FACE, TILE, type Chunk } from "../../core/types.js";
import { generateChunk } from "../index.js";
import {
  reachesNeighborChunk,
  type ChunkCache,
  type WorldPoint,
} from "../test-support.js";

const FLOOR = 1;
const WORLD_SEED = 7919 + 13;
const SEARCH_RANGE = 3;

interface SafeRoomFixture {
  readonly chunk: Chunk;
  readonly cx: number;
  readonly cy: number;
  readonly door: WorldPoint;
}

let cachedFixture: SafeRoomFixture | null = null;

function safeRoomFixture(): SafeRoomFixture {
  if (cachedFixture) return cachedFixture;
  const found = coordinateSquare(SEARCH_RANGE)
    .find(({ cx, cy }) => isSafeRoomChunk({ worldSeed: WORLD_SEED, floor: FLOOR, cx, cy }));
  if (!found) throw new Error(`seed ${WORLD_SEED}: no safe-room chunk within range`);
  const chunk = generateChunk({ worldSeed: WORLD_SEED, floor: FLOOR, ...found });
  const door = findSafeRoomDoor(chunk, found);
  if (!door) throw new Error(`seed ${WORLD_SEED}: safe-room chunk has no kiosk door`);
  cachedFixture = { chunk, ...found, door };
  return cachedFixture;
}

function findSafeRoomDoor(chunk: Chunk, at: { cx: number; cy: number }): WorldPoint | null {
  const index = chunk.features.indexOf(TILE.DoorSafeRoom);
  if (index < 0) return null;
  const lx = index % CHUNK_SIZE;
  const ly = (index - lx) / CHUNK_SIZE;
  return { x: at.cx * CHUNK_SIZE + lx, y: at.cy * CHUNK_SIZE + ly };
}

function coordinateSquare(range: number): Array<{ cx: number; cy: number }> {
  return Array.from({ length: range * 2 + 1 }, (_, x) => x - range)
    .flatMap((cx) => Array.from({ length: range * 2 + 1 }, (_, y) => ({ cx, cy: y - range })));
}

function localIndex(point: WorldPoint, chunk: { cx: number; cy: number }): number {
  return (point.y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE + (point.x - chunk.cx * CHUNK_SIZE);
}

describe("safe-room kiosk stays reachable", () => {
  it("keeps the wall-mounted door independent from its raised collision terrain", () => {
    const { chunk, door, cx, cy } = safeRoomFixture();
    const doorIndex = localIndex(door, { cx, cy });
    const southIndex = localIndex({ x: door.x, y: door.y + 1 }, { cx, cy });
    expect(chunk.tiles[doorIndex]).toBe(TILE.Floor);
    expect(chunk.features[doorIndex]).toBe(TILE.DoorSafeRoom);
    expect(chunk.featureFaces[doorIndex]).toBe(FEATURE_FACE.South);
    expect(chunk.featureHeight[doorIndex]).toBe(0);
    expect(chunk.height[doorIndex]).toBe(2);
    expect(chunk.features[southIndex]).toBe(TILE.Stairs);
    expect(chunk.height[southIndex]).toBe(1);
    expect(chunk.height[southIndex + CHUNK_SIZE]).toBe(0);
  }, 60_000);

  it("the pad the door fronts still reaches the wider corridor network", () => {
    const { door } = safeRoomFixture();
    const cache: ChunkCache = new Map();
    const start: WorldPoint = { x: door.x, y: door.y + 1 };
    expect(reachesNeighborChunk({ seed: WORLD_SEED, floor: FLOOR, cache }, start)).toBe(true);
  }, 60_000);
});
