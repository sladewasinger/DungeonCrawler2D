// Pit interior walls: the rows the base-plane split assigns below z0 render on
// the pit cells themselves — mirrors ownFace.test.ts's terrain() fixture style.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { pitFaceRowAt } from "./pitFace.js";

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
