import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, WALL_RISE } from "../../core/constants.js";
import { TILE } from "../types.js";
import { applyWallHeight, INTERIOR_WALL_RISE } from "./wallHeight.js";

const SIZE = 5;

/** A SIZE×SIZE grid, all Wall, except the listed local (x, y) cells carved to Floor. */
function grid(openCells: Array<[number, number]>): { tiles: Uint8Array; height: Float32Array } {
  const tiles = new Uint8Array(SIZE * SIZE).fill(TILE.Wall);
  for (const [x, y] of openCells) tiles[y * SIZE + x] = TILE.Floor;
  return { tiles, height: new Float32Array(SIZE * SIZE) };
}

describe("wall height: interior fill vs rim", () => {
  it("INTERIOR_WALL_RISE clears the jump apex; WALL_RISE does not", () => {
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(INTERIOR_WALL_RISE).toBeGreaterThan(apex);
    expect(WALL_RISE).toBeLessThan(apex);
  });

  it("a fully-enclosed Wall cell (all 8 neighbors Wall) rises INTERIOR_WALL_RISE", () => {
    // No Floor cells at all: every Wall cell not on the grid's own edge
    // (which this helper treats as an implicit boundary, not open ground)
    // is fully enclosed.
    const { tiles, height } = grid([]);
    applyWallHeight(tiles, height, SIZE);
    const center = 2 * SIZE + 2; // (2,2), interior of the 5x5 grid
    expect(height[center]).toBeCloseTo(INTERIOR_WALL_RISE, 5);
  });

  it("a rim Wall cell (at least one open neighbor) rises only WALL_RISE", () => {
    const { tiles, height } = grid([[2, 2]]); // one Floor cell at the center
    applyWallHeight(tiles, height, SIZE);
    const rim = 1 * SIZE + 2; // (2,1), directly north of the opening
    const stillInterior = 0 * SIZE + 0; // (0,0), corner, far from the opening
    expect(height[rim]).toBeCloseTo(WALL_RISE, 5);
    expect(height[stillInterior]).toBeCloseTo(INTERIOR_WALL_RISE, 5);
  });

  it("stacks on top of a pre-existing base height (a raised room's wall ring)", () => {
    const { tiles, height } = grid([[2, 2]]);
    const rim = 1 * SIZE + 2;
    height[rim] = 1; // e.g. a dais room's ring, stamped before the wall pass
    applyWallHeight(tiles, height, SIZE);
    expect(height[rim]).toBeCloseTo(1 + WALL_RISE, 5);
  });

  it("treats an out-of-grid neighbor as Wall (a mass rarely ends exactly at a chunk seam)", () => {
    const { tiles, height } = grid([]);
    applyWallHeight(tiles, height, SIZE);
    const edge = 0 * SIZE + 2; // (2,0), on the grid's own edge, all real neighbors Wall
    expect(height[edge]).toBeCloseTo(INTERIOR_WALL_RISE, 5);
  });
});
