// Contour classification against hand-built wall shapes: a rectangular room's
// corners/edges, inside corners on an L, T-junctions, isolated pillars, and
// quiet fill — the roles the renderer's art choices hang off.
import { describe, expect, it } from "vitest";
import { classifyWallCell, type SolidNeighbor } from "./wallContour.js";

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
    });
    expect(classifyWallCell(solidAt(run, 2, 0), true, isFace)).toEqual({ kind: "face", frame: "wall_mid" });
    expect(classifyWallCell(solidAt(run, 4, 0), true, (dx) => dx === -1)).toEqual({
      kind: "face",
      frame: "wall_right",
    });
  });

  it("an isolated cell is a pillar, never wall-run art", () => {
    const lone = ["...", ".#.", "..."];
    expect(classify(lone, 1, 1)).toEqual({ kind: "pillar" });
  });

  it("a one-wide finger ending in open ground is a T/end piece, not fill", () => {
    const finger = ["..#..", "..#..", "....."];
    const role = classify(finger, 2, 1);
    expect(role.kind).toBe("rim");
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
