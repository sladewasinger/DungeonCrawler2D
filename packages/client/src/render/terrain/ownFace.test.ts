// Own-tile face model: faces occupy the southernmost rows of a raised surface
// (drop rows deep, capped), never lower ground; cap dashes ride walkable tops.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { hasCapDashSouth, MAX_FACE_ROWS, ownFaceRowAt } from "./ownFace.js";

function terrain(heightsByRow: Record<number, number>, walls: ReadonlySet<number> = new Set()): TerrainRead {
  return {
    heightAt: (_x, y) => heightsByRow[y] ?? 0,
    tileAt: (_x, y): TileType => (walls.has(y) ? TILE.Wall : TILE.Floor),
  };
}

describe("ownFaceRowAt", () => {
  it("a z1 wall row is entirely face; the ground south of it is not", () => {
    const world = terrain({ 4: 1, 5: 0 });
    expect(ownFaceRowAt(world, 0, 4)).toMatchObject({ rowFromTop: 1, distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, 5)).toBeNull();
  });

  it("a z2 surface has a two-row face; deeper cells become top", () => {
    const world = terrain({ 2: 2, 3: 2, 4: 2, 5: 0 });
    expect(ownFaceRowAt(world, 0, 4)).toMatchObject({ rowFromTop: 2, distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, 3)).toMatchObject({ rowFromTop: 1, distanceToGround: 2 });
    expect(ownFaceRowAt(world, 0, 2)).toBeNull();
  });

  it("sub-threshold drops draw no face (ramps stay clean)", () => {
    const world = terrain({ 4: 0.5, 5: 0 });
    expect(ownFaceRowAt(world, 0, 4)).toBeNull();
  });

  it("deep drops cap the face at MAX_FACE_ROWS and mark the last row truncated", () => {
    const world = terrain({ 1: 8, 2: 8, 3: 8, 4: 8, 5: 0 });
    expect(ownFaceRowAt(world, 0, 4)).toMatchObject({ distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, 4 - MAX_FACE_ROWS + 1)).toMatchObject({ truncated: true });
    expect(ownFaceRowAt(world, 0, 4 - MAX_FACE_ROWS)).toBeNull();
  });

  it("terrace-to-terrace drops face like any other edge — stacked terracing reads", () => {
    const world = terrain({ 2: 4, 3: 4, 4: 2, 5: 2, 6: 0 });
    // The z4 terrace's south edge faces down onto the z2 terrace (2-row face)...
    expect(ownFaceRowAt(world, 0, 3)).toMatchObject({ rowFromTop: 2, distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, 2)).toMatchObject({ rowFromTop: 1 });
    // ...and the z2 terrace faces down onto the ground where IT ends.
    expect(ownFaceRowAt(world, 0, 5)).toMatchObject({ distanceToGround: 1 });
  });
});

describe("hasCapDashSouth", () => {
  it("marks the walkable top whose south neighbor is its face row", () => {
    const world = terrain({ 3: 2, 4: 2, 5: 2, 6: 0 });
    expect(hasCapDashSouth(world, 0, 3)).toBe(true);
    expect(hasCapDashSouth(world, 0, 4)).toBe(false);
  });
});
