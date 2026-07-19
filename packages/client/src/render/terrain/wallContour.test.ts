// Contour classification against hand-built wall shapes: a rectangular room's
// corners/edges, inside corners on an L, T-junctions, isolated pillars, and
// quiet fill — the roles the renderer's art choices hang off.
import { describe, expect, it } from "vitest";
import { classifyWallCell, verticalFaceBridgeSide, type SolidNeighbor } from "./wallContour.js";

/** Builds solid() for the cell at (x, y) inside an ASCII map ('#' = wall). */
function solidAt(map: string[], x: number, y: number): SolidNeighbor {
  return (dx, dy) => map[y + dy]?.[x + dx] === "#";
}

const noFace = () => false;

function classify(map: string[], x: number, y: number, selfFace = false) {
  return classifyWallCell(solidAt(map, x, y), selfFace, noFace);
}

describe("classifyWallCell", () => {
  const room = [
    // 5x4 solid block: outer ring is rim, center is fill
    ".......",
    ".#####.",
    ".#####.",
    ".#####.",
    ".#####.",
    ".......",
  ];

  it("classifies a rectangular mass: corners, edges, and interior fill", () => {
    expect(classify(room, 1, 1)).toEqual({ kind: "rim", art: { frame: "wall_edge_top_left" } });
    expect(classify(room, 5, 1)).toEqual({ kind: "rim", art: { frame: "wall_edge_top_right" } });
    expect(classify(room, 1, 4)).toEqual({ kind: "rim", art: { frame: "wall_edge_bottom_left" } });
    expect(classify(room, 5, 4)).toEqual({ kind: "rim", art: { frame: "wall_edge_bottom_right" } });
    expect(classify(room, 3, 1)).toEqual({ kind: "rim", art: { frame: "wall_top_mid" } });
    expect(classify(room, 1, 2)).toEqual({ kind: "rim", art: { frame: "wall_edge_mid_left" } });
    expect(classify(room, 5, 2)).toEqual({ kind: "rim", art: { frame: "wall_edge_mid_right" } });
    expect(classify(room, 3, 2)).toEqual({ kind: "fill" });
  });

  it("face cells pick run-aware face pieces from face continuity", () => {
    const run = ["#####", "....."];
    const isFace = () => true;
    expect(classifyWallCell(solidAt(run, 0, 0), true, (dx) => dx === 1)).toEqual({
      kind: "face",
      frame: "wall_left",
      outline: { north: true, west: true, east: false },
    });
    expect(classifyWallCell(solidAt(run, 2, 0), true, isFace)).toEqual({
      kind: "face",
      frame: "wall_mid",
      outline: { north: true, west: false, east: false },
    });
    expect(classifyWallCell(solidAt(run, 4, 0), true, (dx) => dx === -1)).toEqual({
      kind: "face",
      frame: "wall_right",
      outline: { north: true, west: false, east: true },
    });
  });

  it("an isolated cell is a pillar, never wall-run art", () => {
    const lone = ["...", ".#.", "..."];
    expect(classify(lone, 1, 1)).toEqual({ kind: "pillar" });
  });

  it("caps the south endpoint of a one-wide vertical ridge", () => {
    const finger = ["..#..", "..#..", "....."];
    expect(classify(finger, 2, 1)).toEqual({
      kind: "rim",
      art: { frame: "wall_edge_mid_left", texturedFill: true, capSouth: true, capEast: true },
    });
  });

  it("caps the north endpoint of a one-wide vertical ridge", () => {
    const finger = [".....", "..#..", "..#.."];
    expect(classify(finger, 2, 1)).toEqual({
      kind: "rim",
      art: { frame: "wall_edge_mid_left", texturedFill: true, capNorth: true, capEast: true },
    });
  });

  it("caps both exposed sides through the middle of a one-wide vertical ridge", () => {
    const ridge = ["..#..", "..#..", "..#.."];
    expect(classify(ridge, 2, 1)).toEqual({
      kind: "rim",
      art: { frame: "wall_edge_mid_left", texturedFill: true, capEast: true },
    });
  });

  it("detects a projected face that should become a continuous vertical T-junction", () => {
    const westJunction = ["..#..", ".##..", ".....", "..#.."];
    const eastJunction = ["..#..", "..##.", ".....", "..#.."];
    expect(verticalFaceBridgeSide(solidAt(westJunction, 2, 1), true)).toBe("west");
    expect(verticalFaceBridgeSide(solidAt(eastJunction, 2, 1), true)).toBe("east");
    expect(verticalFaceBridgeSide(solidAt(westJunction, 2, 1), false)).toBeUndefined();
  });

  it("an inside corner uses the inward-facing corner piece instead of breaking the junction", () => {
    const ell = [
      "####.",
      "####.",
      "##...",
      "##...",
    ];
    const role = classify(ell, 1, 1);
    expect(role).toEqual({ kind: "rim", art: { frame: "wall_outer_top_left" } });
  });

  it("selects all four inward-facing pieces around a cavity", () => {
    const cavity = ["######", "######", "##..##", "##..##", "######", "######"];
    expect(classify(cavity, 1, 1)).toEqual({ kind: "rim", art: { frame: "wall_outer_top_left" } });
    expect(classify(cavity, 4, 1)).toEqual({ kind: "rim", art: { frame: "wall_outer_top_right" } });
    expect(classify(cavity, 1, 4)).toEqual({ kind: "rim", art: { frame: "wall_outer_front_left" } });
    expect(classify(cavity, 4, 4)).toEqual({ kind: "rim", art: { frame: "wall_outer_front_right" } });
  });
});
