// Pit interior walls: the rows the base-plane split assigns below z0 render on
// the pit cells themselves — mirrors ownFace.test.ts's terrain() fixture style.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { pitFaceRowAt, pitRunPieceAt } from "./pitFace.js";

function terrain(heightsByRow: Record<number, number>): TerrainRead {
  return {
    heightAt: (_x, y) => heightsByRow[y] ?? 0,
    tileAt: (): TileType => TILE.Floor,
  };
}

/** heights/tiles keyed "x,y"; missing heights default to 0, missing tiles to Floor. */
function grid(heights: Record<string, number>, walls: ReadonlySet<string> = new Set()): TerrainRead {
  return {
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    tileAt: (x, y) => (walls.has(`${x},${y}`) ? TILE.Wall : TILE.Floor),
  };
}

describe("pitFaceRowAt", () => {
  it("a 0 -> -1 edge draws its single row inside the pit's northmost cell", () => {
    const world = terrain({ 4: 0, 5: -1, 6: -1 });
    expect(pitFaceRowAt(world, 0, 5)).toMatchObject({ rowFromTop: 1, surfaceHeight: 0 });
    // Deeper pit cells keep their dark floor.
    expect(pitFaceRowAt(world, 0, 6)).toBeNull();
  });

  it("a 1 -> -1 edge continues the raised row downward as row 2 inside the pit", () => {
    const world = terrain({ 4: 1, 5: -1 });
    expect(pitFaceRowAt(world, 0, 5)).toMatchObject({ rowFromTop: 2, surfaceHeight: 1 });
  });

  it("a deep 0 -> -4 chasm edge caps at MAX_FACE_ROWS and fades its deepest row", () => {
    const world = terrain({ 4: 0, 5: -4, 6: -4, 7: -4, 8: -4 });
    expect(pitFaceRowAt(world, 0, 5)).toMatchObject({ rowFromTop: 1, truncated: false });
    expect(pitFaceRowAt(world, 0, 6)).toMatchObject({ rowFromTop: 2, truncated: false });
    expect(pitFaceRowAt(world, 0, 7)).toMatchObject({ rowFromTop: 3, truncated: true });
    expect(pitFaceRowAt(world, 0, 8)).toBeNull();
  });

  it("never fires at or above the base plane — those faces belong to ownFace.ts", () => {
    const world = terrain({ 4: 1, 5: 0 });
    expect(pitFaceRowAt(world, 0, 5)).toBeNull();
  });

  it("excludes sub-threshold rises (a gentle dip is not a wall)", () => {
    const world = terrain({ 4: -0.5, 5: -1 });
    expect(pitFaceRowAt(world, 0, 5)).toBeNull();
  });
});

describe("pitRunPieceAt — ONE outline at a pit rim (VISUAL_DIRECTION.md)", () => {
  const heights = { "5,4": 0, "6,4": 0, "5,5": -1, "6,5": -1 };

  it("suppresses the side closure where the non-connecting neighbor is open ground — the ground tile's own topEdges already draws that seam", () => {
    const world = grid({ ...heights, "4,5": 0 });
    expect(pitRunPieceAt(world, 5, 5)).toMatchObject({ closeWest: false });
  });

  it("keeps the side closure where the non-connecting neighbor is a wall — nothing else draws that seam", () => {
    const world = grid({ ...heights, "4,5": 0 }, new Set(["4,5"]));
    expect(pitRunPieceAt(world, 5, 5)).toMatchObject({ closeWest: true });
  });
});
