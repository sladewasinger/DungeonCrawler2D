// Unified ground faces: stacked rows proportional to the drop, capped with a
// truncation fade, cast only onto ground actually at the ledge's foot.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { groundFaceRowAt, hasSouthCapDash, MAX_FACE_ROWS } from "./groundFaces.js";

function terrain(heightsByRow: Record<number, number>, walls: ReadonlySet<number> = new Set()): TerrainRead {
  return {
    heightAt: (_x, y) => heightsByRow[y] ?? 0,
    tileAt: (_x, y): TileType => (walls.has(y) ? TILE.Wall : TILE.Floor),
  };
}

describe("groundFaceRowAt", () => {
  it("a z2 ledge casts two rows, brightest first", () => {
    const world = terrain({ 4: 2, 5: 0, 6: 0, 7: 0 });
    expect(groundFaceRowAt(world, 0, 5)).toMatchObject({ rowIndex: 1, sourceHeight: 2 });
    expect(groundFaceRowAt(world, 0, 6)).toMatchObject({ rowIndex: 2, sourceHeight: 2 });
    expect(groundFaceRowAt(world, 0, 7)).toBeNull();
  });

  it("a z1-style sub-threshold drop casts nothing (ramps stay clean)", () => {
    const world = terrain({ 4: 1, 5: 0 });
    expect(groundFaceRowAt(world, 0, 5)).toBeNull();
  });

  it("deep drops cap at MAX_FACE_ROWS with the last row marked truncated", () => {
    const world = terrain({ 4: 8, 5: 0, 6: 0, 7: 0, 8: 0 });
    expect(groundFaceRowAt(world, 0, 4 + MAX_FACE_ROWS)).toMatchObject({ truncated: true });
    expect(groundFaceRowAt(world, 0, 5 + MAX_FACE_ROWS)).toBeNull();
  });

  it("wall tiles neither cast (handled elsewhere) nor receive ground faces", () => {
    const world = terrain({ 4: 2, 5: 0 }, new Set([4]));
    expect(groundFaceRowAt(world, 0, 5)).toBeNull();
  });
});

describe("hasSouthCapDash", () => {
  it("marks the raised top's south edge, but never wall tiles", () => {
    expect(hasSouthCapDash(terrain({ 4: 2, 5: 0 }), 0, 4)).toBe(true);
    expect(hasSouthCapDash(terrain({ 4: 2, 5: 2 }), 0, 4)).toBe(false);
    expect(hasSouthCapDash(terrain({ 4: 2, 5: 0 }, new Set([4])), 0, 4)).toBe(false);
  });
});
