import { describe, expect, it } from "vitest";
import { TILE } from "../types.js";
import { resolveShallowPlateaus, resolveThinWalls } from "./verticalExtent.js";

const SIZE = 8;

function wallGrid(wallRows: number[], x = 3): Uint8Array {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
  for (let y = 0; y < SIZE; y++) tiles[y * SIZE + x] = wallRows.includes(y) ? TILE.Wall : TILE.Floor;
  return tiles;
}

describe("resolveThinWalls", () => {
  it("merges a 1-deep free-standing wall (floor both sides) into floor", () => {
    const tiles = wallGrid([3], 3);
    resolveThinWalls(tiles, SIZE);
    expect(tiles[3 * SIZE + 3]).toBe(TILE.Floor);
  });

  it("leaves a 2-deep wall run alone — already satisfies z+1 for z1", () => {
    const tiles = wallGrid([3, 4], 3);
    resolveThinWalls(tiles, SIZE);
    expect(tiles[3 * SIZE + 3]).toBe(TILE.Wall);
    expect(tiles[4 * SIZE + 3]).toBe(TILE.Wall);
  });

  it("leaves a 1-deep wall touching the chunk's north edge alone — true depth may continue into the neighbor chunk", () => {
    const tiles = wallGrid([0], 3);
    resolveThinWalls(tiles, SIZE);
    expect(tiles[0 * SIZE + 3]).toBe(TILE.Wall);
  });

  it("leaves a 1-deep wall touching the chunk's south edge alone, for the same reason", () => {
    const tiles = wallGrid([SIZE - 1], 3);
    resolveThinWalls(tiles, SIZE);
    expect(tiles[(SIZE - 1) * SIZE + 3]).toBe(TILE.Wall);
  });
});

function plateauGrid(rows: Record<number, number>, x = 3): { tiles: Uint8Array; height: Float32Array } {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Floor);
  const height = new Float32Array(SIZE * SIZE);
  for (const [y, h] of Object.entries(rows)) height[Number(y) * SIZE + x] = h;
  return { tiles, height };
}

describe("resolveShallowPlateaus", () => {
  it("caps a z2 run only 1 deep (drops straight to 0) down to the height its depth actually supports", () => {
    const { tiles, height } = plateauGrid({ 3: 2 }, 3);
    resolveShallowPlateaus(tiles, height, SIZE);
    expect(height[3 * SIZE + 3]).toBe(0);
  });

  it("caps a z3 run 2 deep down to z1 — depth 2 supports at most z1 (z+1=2)", () => {
    const { tiles, height } = plateauGrid({ 3: 3, 4: 3 }, 3);
    resolveShallowPlateaus(tiles, height, SIZE);
    expect(height[3 * SIZE + 3]).toBe(1);
    expect(height[4 * SIZE + 3]).toBe(1);
  });

  it("leaves a z1 run 2 deep alone — already satisfies z+1", () => {
    const { tiles, height } = plateauGrid({ 3: 1, 4: 1 }, 3);
    resolveShallowPlateaus(tiles, height, SIZE);
    expect(height[3 * SIZE + 3]).toBe(1);
    expect(height[4 * SIZE + 3]).toBe(1);
  });

  it("leaves a run truncated at the chunk's south edge alone — true depth is unknown", () => {
    const { tiles, height } = plateauGrid({ [SIZE - 1]: 2 }, 3);
    resolveShallowPlateaus(tiles, height, SIZE);
    expect(height[(SIZE - 1) * SIZE + 3]).toBe(2);
  });

  it("a door tile breaks the run without itself being flagged (the rule's one intentional hole)", () => {
    const { tiles, height } = plateauGrid({ 3: 2, 4: 2 }, 3);
    tiles[4 * SIZE + 3] = TILE.DoorSafeRoom;
    resolveShallowPlateaus(tiles, height, SIZE);
    // Row 3 alone is 1 deep before the door, but the door sits at the same
    // height (no drop), so nothing south of row 3 ever reads as open ground.
    expect(height[3 * SIZE + 3]).toBe(2);
  });
});
