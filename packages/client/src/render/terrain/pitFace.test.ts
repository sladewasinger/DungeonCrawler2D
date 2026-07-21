// Pit interior walls: the rows the base-plane split assigns below z0 render on
// the pit cells themselves — mirrors ownFace.test.ts's terrain() fixture style.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { MAX_FACE_ROWS } from "./ownFace.js";
import { pitFaceRowAt, pitStepFaceRowsAt } from "./pitFace.js";

function terrain(heightsByRow: Record<number, number>): TerrainRead {
  return {
    heightAt: (_x, y) => heightsByRow[y] ?? 0,
    tileAt: (): TileType => TILE.Floor,
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

  it("draws a stepped pit face below its own lowered floor cap", () => {
    const world = terrain({ 4: 0, 5: -1, 6: -2 });
    expect(pitFaceRowAt(world, 0, 5)).toMatchObject({ rowFromTop: 1, surfaceHeight: 0 });
    expect(pitFaceRowAt(world, 0, 6)).toBeNull();
    expect(pitStepFaceRowsAt(world, 0, 5)).toMatchObject([
      { rowFromTop: 1, totalRows: 1, surfaceHeight: -1, screenY: 7, isStep: true, truncated: false },
    ]);
  });

  it("a deep chasm edge caps at MAX_FACE_ROWS and fades its deepest row", () => {
    // A pit deeper (in both raw depth and consecutive same-depth rows) than
    // MAX_FACE_ROWS, built from the constant so this stays correct at any cap size.
    const wallTopRow = 4;
    const rawDrop = MAX_FACE_ROWS + 4;
    const heights: Record<number, number> = { [wallTopRow]: 0 };
    for (let y = wallTopRow + 1; y <= wallTopRow + MAX_FACE_ROWS + 2; y++) heights[y] = -rawDrop;
    const world = terrain(heights);
    expect(pitFaceRowAt(world, 0, wallTopRow + 1)).toMatchObject({ rowFromTop: 1, truncated: false });
    const truncatedRow = wallTopRow + MAX_FACE_ROWS;
    expect(pitFaceRowAt(world, 0, truncatedRow)).toMatchObject({ rowFromTop: MAX_FACE_ROWS, truncated: true });
    expect(pitFaceRowAt(world, 0, truncatedRow + 1)).toBeNull();
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
