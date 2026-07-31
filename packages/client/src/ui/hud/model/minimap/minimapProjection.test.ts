import { describe, expect, it } from "vitest";
import {
  minimapMarkerColor,
  projectMinimapPoint,
} from "./minimapProjection.js";

describe("minimap projection", () => {
  it("keeps world north at the top when the view is north-facing", () => {
    expect(projectMinimapPoint({
      dx: 0,
      dy: -4,
      bearingDeg: 0,
      rangeTiles: 8,
      radiusPx: 40,
    })).toMatchObject({ x: 0, y: -20, inside: true });
  });

  it("rotates map points with the camera bearing", () => {
    expect(projectMinimapPoint({
      dx: 0,
      dy: -4,
      bearingDeg: 90,
      rangeTiles: 8,
      radiusPx: 40,
    })).toMatchObject({ x: 20, y: 0, inside: true });
  });

  it("clamps off-map targets to the circular edge without changing direction", () => {
    const point = projectMinimapPoint({
      dx: 0,
      dy: -20,
      bearingDeg: 0,
      rangeTiles: 8,
      radiusPx: 40,
      edgePaddingPx: 4,
    });
    expect(point.inside).toBe(false);
    expect(point.x).toBe(0);
    expect(point.y).toBe(-36);
  });

  it("uses distinct colors for ordinary players, enemies, and party members", () => {
    expect(minimapMarkerColor("player")).toBe("#aeb4c5");
    expect(minimapMarkerColor("enemy")).toBe("#ef5350");
    expect(minimapMarkerColor("party")).toBe("#56d98b");
  });
});
