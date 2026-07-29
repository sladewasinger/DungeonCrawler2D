import { describe, expect, it } from "vitest";
import {
  cliffRimSideBand,
  outsideCornersForSides,
  roundedCliffRimCorner,
} from "./cliffRimGeometry.js";
import type { ProjectedTerrainQuad } from "./projectedTerrainQuad.js";

const QUAD: ProjectedTerrainQuad = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("cliff rim outside corners", () => {
  it("recognizes only adjacent exposed sides as outside corners", () => {
    expect(outsideCornersForSides(["north", "west"])).toEqual(["nw"]);
    expect(outsideCornersForSides(["east", "south"])).toEqual(["se"]);
    expect(outsideCornersForSides(["north", "south"])).toEqual([]);
    expect(outsideCornersForSides(["east"])).toEqual([]);
  });

  it("finds both outside corners on three exposed sides", () => {
    expect(outsideCornersForSides(["north", "east", "south"]))
      .toEqual(["ne", "se"]);
  });

  it("trims straight bands before their rounded corner tangent", () => {
    const east = cliffRimSideBand({
      points: QUAD, side: "east", width: 0.04, corners: ["se"], radius: 0.16,
    });
    const south = cliffRimSideBand({
      points: QUAD, side: "south", width: 0.04, corners: ["se"], radius: 0.16,
    });

    expect(east[2].y).toBeCloseTo(84);
    expect(south[2].x).toBeCloseTo(84);
  });

  it("trims both ends of a side shared by two outside corners", () => {
    const east = cliffRimSideBand({
      points: QUAD,
      side: "east",
      width: 0.04,
      corners: ["ne", "se"],
      radius: 0.16,
    });

    expect(east[0].y).toBeCloseTo(16);
    expect(east[2].y).toBeCloseTo(84);
  });

  it("joins trimmed bands without touching the square tile corner", () => {
    const points = roundedCliffRimCorner({
      points: QUAD, corner: "se", radius: 0.16, width: 0.04, segments: 4,
    });

    expect(points).toHaveLength(10);
    expect(points).not.toContainEqual({ x: 100, y: 100 });
    expect(points[0]?.x).toBeCloseTo(100);
    expect(points[0]?.y).toBeCloseTo(84);
    expect(points[4]?.x).toBeCloseTo(84);
    expect(points[4]?.y).toBeCloseTo(100);
  });
});
