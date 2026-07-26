import { stairRampAt, TILE, type StairView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { steppedStairSurface } from "./sideStair.js";

const DIRECTIONS = [0, 1, 2, 3] as const;

function singleTileNorthSouthRamp(
  direction: 0 | 2,
  lowHeight: number,
): (x: number, y: number) => number {
  const highY = direction === 0 ? -1 : 1;
  const view: StairView = {
    tileAt: (wx, wy) => wx === 0 && wy === 0 ? TILE.Stairs : TILE.Floor,
    heightAt: (wx, wy) => {
      if (wx === 0 && wy === 0) return lowHeight + 0.5;
      return wy === highY ? lowHeight + 1 : lowHeight;
    },
  };
  return (x, y) =>
    stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
}

function bandGeometry(band: ReturnType<typeof steppedStairSurface>["bands"][number]) {
  const rounded = (value: number) => Math.round(value * 1e12) / 1e12;
  const roundedRange = (range: readonly [number, number]) =>
    range.map(rounded);
  return {
    start: rounded(band.start),
    end: rounded(band.end),
    sample: rounded(band.sample),
    sampleX: rounded(band.sampleX),
    sampleY: rounded(band.sampleY),
    fillX: roundedRange(band.fillX),
    fillY: roundedRange(band.fillY),
    highlightX: roundedRange(band.highlightX),
    highlightY: roundedRange(band.highlightY),
  };
}

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

  it("samples ground height along x for vertical bands and y plus both landings for horizontal bands", () => {
    const xSamples: Array<[number, number]> = [];
    const xSurface = steppedStairSurface(10, 20, 1, (x, y) => {
      xSamples.push([x, y]);
      return 0;
    });
    expect(xSamples.map(([x]) => x)).toEqual(
      xSurface.bands.map(({ sample }) => 10 + sample),
    );
    expect(xSamples.every(([, y]) => y === 20.5)).toBe(true);

    const ySamples: Array<[number, number]> = [];
    const ySurface = steppedStairSurface(10, 20, 0, (x, y) => {
      ySamples.push([x, y]);
      return 0;
    });
    expect(ySamples.map(([, y]) => y)).toEqual([
      ...ySurface.bands.map(({ sample }) => 20 + sample),
      20,
      21,
    ]);
    expect(ySamples.every(([x]) => x === 10.5)).toBe(true);
  });

  it("progressively widens north/south tread depth toward the high end", () => {
    for (const direction of [0, 2]) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      const widths = surface.bands.map(({ start, end }) => end - start);
      const towardHigh = surface.highAtStart ? widths : [...widths].reverse();
      expect(towardHigh.every((width, index) =>
        index === 0 || width < (towardHigh[index - 1] ?? 0))).toBe(true);
    }
  });

  it("keeps the original equal-width east/west band profile", () => {
    for (const direction of [1, 3]) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      expect(surface.bands.map(({ start, end, sample }) => ({
        start,
        end,
        sample,
      }))).toEqual([
        { start: 0, end: 0.2, sample: 0.1 },
        { start: 0.2, end: 0.4, sample: 0.3 },
        { start: 0.4, end: 0.6, sample: 0.5 },
        { start: 0.6, end: 0.8, sample: 0.7 },
        { start: 0.8, end: 1, sample: 0.9 },
      ]);
    }
  });

  it("covers every projected riser gap and both landing seams on north/south pit stairs", () => {
    for (const direction of [0, 2] as const) {
      const groundAt = singleTileNorthSouthRamp(direction, -1);
      const surface = steppedStairSurface(0, 0, direction, groundAt);
      const projected = surface.bands.map((band) => ({
        start: band.fillY[0] - band.height,
        end: band.fillY[1] - band.height,
      }));
      const startLanding = -groundAt(0.5, 0);
      const endLanding = 1 - groundAt(0.5, 1);

      expect(projected[0]?.start).toBeLessThanOrEqual(startLanding);
      expect(projected[0]?.end).toBeGreaterThanOrEqual(startLanding);
      expect(projected.at(-1)?.start).toBeLessThanOrEqual(endLanding);
      expect(projected.at(-1)?.end).toBeGreaterThanOrEqual(endLanding);
      projected.slice(1).forEach((band, index) => {
        expect(band.start).toBeLessThanOrEqual(projected[index]?.end ?? Number.NEGATIVE_INFINITY);
      });
    }
  });

  it("translates identical north/south ramps by exactly one tile per height level", () => {
    for (const direction of [0, 2] as const) {
      const pit = steppedStairSurface(0, 0, direction, singleTileNorthSouthRamp(direction, -1));
      const raised = steppedStairSurface(0, 0, direction, singleTileNorthSouthRamp(direction, 0));

      expect(raised.axis).toBe(pit.axis);
      expect(raised.highAtStart).toBe(pit.highAtStart);
      raised.bands.forEach((band, index) => {
        const pitBand = pit.bands[index];
        if (!pitBand) throw new Error(`missing pit band ${index}`);
        expect(bandGeometry(band)).toEqual(bandGeometry(pitBand));
        expect(band.height).toBeCloseTo(pitBand.height + 1);
        expect(band.liftBakePx).toBeCloseTo(pitBand.liftBakePx + 16);
      });
    }
  });

  it("does not alter east/west projected band geometry", () => {
    for (const direction of [1, 3]) {
      const surface = steppedStairSurface(0, 0, direction, (x) => x - 0.5);
      expect(surface.bands.map((band) => ({
        fillX: band.fillX,
        fillY: band.fillY,
        highlightX: band.highlightX,
        highlightY: band.highlightY,
      }))).toEqual(surface.bands.map((band) => ({
        fillX: [band.start, band.end],
        fillY: [0, 1],
        highlightX: direction === 1
          ? [Math.max(band.start, band.end - 0.045), band.end]
          : [band.start, Math.min(band.end, band.start + 0.045)],
        highlightY: [0, 1],
      })));
    }
  });

  it("covers the full two-tile projected length for both north-climbing height ranges", () => {
    for (const lowHeight of [-1, 0]) {
      const surface = steppedStairSurface(0, 0, 0, singleTileNorthSouthRamp(0, lowHeight));
      const projected = surface.bands.map((band) => ({
        start: band.fillY[0] - band.height,
        end: band.fillY[1] - band.height,
      }));
      const start = Math.min(...projected.map((band) => band.start));
      const end = Math.max(...projected.map((band) => band.end));
      expect(end - start).toBeCloseTo(2);
    }
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
