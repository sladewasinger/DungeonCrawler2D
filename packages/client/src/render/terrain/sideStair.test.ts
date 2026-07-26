import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { steppedStairSurface } from "./sideStair.js";

const DIRECTIONS = [0, 1, 2, 3] as const;

describe("stepped stair surface", () => {
  it("covers the tile with five contiguous filled bands on both axes", () => {
    for (const direction of [0, 1]) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      expect(surface.bands).toHaveLength(5);
      expect(surface.bands[0]?.start).toBe(0);
      expect(surface.bands.at(-1)?.end).toBe(1);
      expect(surface.bands.every((band, index) =>
        index === 0 || band.start === surface.bands[index - 1]?.end)).toBe(true);
      for (const band of surface.bands) {
        if (surface.axis === "x") {
          expect(band.fillX).toEqual([band.start, band.end]);
          expect(band.fillY).toEqual([0, 1]);
        } else {
          expect(band.fillX).toEqual([0, 1]);
          expect(band.fillY).toEqual([band.start, band.end]);
        }
      }
    }
  });

  it("samples ground height along x for vertical bands and y for horizontal bands", () => {
    const xSamples: Array<[number, number]> = [];
    steppedStairSurface(10, 20, 1, (x, y) => {
      xSamples.push([x, y]);
      return 0;
    });
    expect(xSamples).toEqual([
      [10.1, 20.5],
      [10.3, 20.5],
      [10.5, 20.5],
      [10.7, 20.5],
      [10.9, 20.5],
    ]);

    const ySamples: Array<[number, number]> = [];
    steppedStairSurface(10, 20, 0, (x, y) => {
      ySamples.push([x, y]);
      return 0;
    });
    expect(ySamples).toEqual([
      [10.5, 20.1],
      [10.5, 20.3],
      [10.5, 20.5],
      [10.5, 20.7],
      [10.5, 20.9],
    ]);
  });

  it("mirrors equal height samples and high-facing highlights at opposite ends", () => {
    const east = steppedStairSurface(0, 0, 1, (x) => x);
    const west = steppedStairSurface(0, 0, 3, (x) => 1 - x);

    west.bands.forEach((band, index) => {
      expect(band.height).toBeCloseTo(east.bands.at(-(index + 1))?.height ?? Number.NaN);
    });
    expect(east.highAtStart).toBe(false);
    expect(west.highAtStart).toBe(true);
    for (const band of east.bands) expect(band.highlightX[1]).toBe(band.end);
    for (const band of west.bands) expect(band.highlightX[0]).toBe(band.start);
  });

  it("keeps the axis and high end correct after every camera-direction remap", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const worldDirection of DIRECTIONS) {
        const screenDirection = screenClimbDirIndex(worldDirection, orientation);
        const oppositeScreenDirection = screenClimbDirIndex((worldDirection + 2) % 4, orientation);
        const surface = steppedStairSurface(0, 0, screenDirection, () => 0);
        const opposite = steppedStairSurface(0, 0, oppositeScreenDirection, () => 0);

        expect(surface.axis).toBe(screenDirection === 0 || screenDirection === 2 ? "y" : "x");
        expect(surface.highAtStart).toBe(screenDirection === 0 || screenDirection === 3);
        expect(opposite.axis).toBe(surface.axis);
        expect(opposite.highAtStart).toBe(!surface.highAtStart);
      }
    }
  });

  it("preserves positive and negative elevation lifts for every sampled band", () => {
    const surface = steppedStairSurface(0, 0, 1, (x) => x < 0.5 ? -1 : 2);

    expect(surface.bands.map((band) => band.liftBakePx)).toEqual([-16, -16, 32, 32, 32]);
  });
});
