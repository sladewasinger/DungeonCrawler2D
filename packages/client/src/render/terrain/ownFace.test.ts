// Own-tile face model: faces occupy the southernmost rows of a raised surface
// (drop rows deep, capped), split at the base plane — a surface only owns as
// many rows as it rises above z0; the rest continue into the pit (pitFace.ts).
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { faceRunPieceAt, MAX_FACE_ROWS, ownFaceRowAt } from "./ownFace.js";

function terrain(heightsByRow: Record<number, number>, walls: ReadonlySet<number> = new Set()): TerrainRead {
  return {
    heightAt: (_x, y) => heightsByRow[y] ?? 0,
    tileAt: (_x, y): TileType => (walls.has(y) ? TILE.Wall : TILE.Floor),
  };
}

/** 2D terrain fixture, needed once a test cares about horizontal (x) neighbors, not just south drop. */
function terrain2D(heights: Record<string, number>): TerrainRead {
  return {
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    tileAt: (): TileType => TILE.Floor,
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
    // A mass taller (in both raw height and consecutive same-height rows) than
    // MAX_FACE_ROWS, so the scan itself runs the full cap before finding the
    // drop — built from the constant so this stays correct at any cap size.
    const rawDrop = MAX_FACE_ROWS + 4;
    const groundRow = 1 + MAX_FACE_ROWS + 2;
    const heights: Record<number, number> = {};
    for (let y = 1; y < groundRow; y++) heights[y] = rawDrop;
    heights[groundRow] = 0;
    const world = terrain(heights);
    const truncatedRow = groundRow - MAX_FACE_ROWS;
    expect(ownFaceRowAt(world, 0, groundRow - 1)).toMatchObject({ distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, truncatedRow)).toMatchObject({ truncated: true });
    expect(ownFaceRowAt(world, 0, truncatedRow - 1)).toBeNull();
  });

  it("terrace-to-terrace drops face like any other edge — stacked terracing reads", () => {
    const world = terrain({ 2: 4, 3: 4, 4: 2, 5: 2, 6: 0 });
    // The z4 terrace's south edge faces down onto the z2 terrace (2-row face)...
    expect(ownFaceRowAt(world, 0, 3)).toMatchObject({ rowFromTop: 2, distanceToGround: 1 });
    expect(ownFaceRowAt(world, 0, 2)).toMatchObject({ rowFromTop: 1 });
    // ...and the z2 terrace faces down onto the ground where IT ends.
    expect(ownFaceRowAt(world, 0, 5)).toMatchObject({ distanceToGround: 1 });
  });

  it("splits at the base plane: a z1 surface over a -1 pit keeps only its above-base row", () => {
    // Drop is 2, but only round(1) = 1 row belongs to the raised tile — the
    // second row continues INSIDE the pit (pitFace.ts), so the z1 cell shows
    // the face's TOP row, not its bottom.
    const world = terrain({ 4: 1, 5: -1 });
    expect(ownFaceRowAt(world, 0, 4)).toMatchObject({ rowFromTop: 1, distanceToGround: 1 });
  });

  it("flat base-plane ground beside a pit stays faceless — the wall renders inside the hole", () => {
    const world = terrain({ 4: 0, 5: -1 });
    expect(ownFaceRowAt(world, 0, 4)).toBeNull();
  });
});

describe("faceRunPieceAt", () => {
  it("picks wall_mid for the interior of a run and endcaps its two ends", () => {
    // A 3-wide face row: (4,0) west end, (5,0) middle, (6,0) east end.
    const world = terrain2D({ "4,0": 1, "5,0": 1, "6,0": 1, "4,1": 0, "5,1": 0, "6,1": 0 });
    expect(faceRunPieceAt(world, 4, 0)).toEqual({ frame: "wall_left", closeWest: true, closeEast: false });
    expect(faceRunPieceAt(world, 5, 0)).toEqual({ frame: "wall_mid", closeWest: false, closeEast: false });
    expect(faceRunPieceAt(world, 6, 0)).toEqual({ frame: "wall_right", closeWest: false, closeEast: true });
  });

  it("closes BOTH sides of an isolated one-wide face column instead of defaulting to wall_mid", () => {
    // Regression: neither neighbor is a face at this row, so the old `!west && east` /
    // `west && !east` chain fell through to wall_mid — seamless brick tiling with no
    // border on either genuinely-open side.
    const world = terrain2D({ "5,0": 1, "5,1": 0 });
    expect(faceRunPieceAt(world, 5, 0)).toEqual({ frame: "wall_left", closeWest: true, closeEast: true });
  });

  it("still closes a side whose neighbor shares this cell's height but faces one row further south (a ramp delay)", () => {
    // (4,0) is the SAME wall mass as the target and even the same height, but its own
    // south drop doesn't land until row 1 — at row 0 it renders non-brick contour art,
    // so the target still needs its west border, same as it would against open air.
    const world = terrain2D({
      "5,0": 1,
      "5,1": 0,
      "4,0": 1,
      "4,1": 1,
      "4,2": 0,
      "6,0": 1,
      "6,1": 0,
    });
    expect(faceRunPieceAt(world, 5, 0)).toEqual({ frame: "wall_left", closeWest: true, closeEast: false });
  });
});
