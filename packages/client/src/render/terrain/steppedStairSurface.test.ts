import { stairRampAt, TILE, type StairView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { screenClimbDirIndex } from "./stairScreenDirection.js";
import { TREAD_COUNT } from "./stairTread.js";
import { steppedStairSurface } from "./steppedStairSurface.js";

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
  const roundedFace = (face: typeof band.floor) => face && ({
    x: roundedRange(face.x), y: roundedRange(face.y),
  });
  return {
    start: rounded(band.start),
    end: rounded(band.end),
    sample: rounded(band.sample),
    sampleX: rounded(band.sampleX),
    sampleY: rounded(band.sampleY),
    floor: roundedFace(band.floor),
    tread: roundedFace(band.tread),
    riser: roundedFace(band.riser),
  };
}

describe("stepped stair surface", () => {
  it("keeps horizontal bands as contiguous equal-width tile slices", () => {
    for (const direction of [1, 3]) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      expect(surface.bands).toHaveLength(TREAD_COUNT);
      expect(surface.bands[0]?.start).toBe(0);
      expect(surface.bands.at(-1)?.end).toBe(1);
      expect(surface.bands.every((band, index) =>
        index === 0 || band.start === surface.bands[index - 1]?.end)).toBe(true);
      for (const band of surface.bands) {
        expect(band.floor).toEqual({ x: [band.start, band.end], y: [0, 1] });
      }
    }
  });

  it("samples ground height along x for horizontal bands and y plus the center projection for vertical bands", () => {
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
      20.5,
    ]);
    expect(ySamples.slice(0, ySurface.bands.length).every(([x]) => x === 10)).toBe(true);
    expect(ySamples.at(-1)?.[0]).toBe(10.5);
  });

  it("keeps vertical treads linear and gives each one a shaded riser face", () => {
    for (const direction of [0, 2] as const) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      const widths = surface.bands.map(({ start, end }) => end - start);
      expect(widths).toEqual(Array.from({ length: TREAD_COUNT }, () => 1 / TREAD_COUNT));
      for (const band of surface.bands) {
        const riser = band.riser;
        if (!riser) throw new Error("vertical tread must include a riser face");
        expect(band.floor).toBeUndefined();
        expect(riser.x).toEqual([0, 1]);
        const projectedHighlight: readonly [number, number] = [
          band.tread.y[0] - band.height,
          band.tread.y[1] - band.height,
        ];
        const projectedRiser: readonly [number, number] = [
          riser.y[0] - band.height,
          riser.y[1] - band.height,
        ];
        if (direction === 0) {
          expect(projectedRiser[0]).toBeCloseTo(projectedHighlight[1]);
        } else {
          expect(projectedRiser[1]).toBeCloseTo(projectedHighlight[0]);
        }
      }
    }
  });

  it("keeps the original equal-width east/west band profile", () => {
    for (const direction of [1, 3]) {
      const surface = steppedStairSurface(0, 0, direction, () => 0);
      expect(surface.bands.map(({ start, end, sample }) => ({
        start,
        end,
        sample,
      }))).toEqual(Array.from({ length: TREAD_COUNT }, (_, index) => ({
        start: index / TREAD_COUNT,
        end: (index + 1) / TREAD_COUNT,
        sample: (index + 0.5) / TREAD_COUNT,
      })));
    }
  });

  it("covers a continuous two-tile projected run with exactly four vertical bands", () => {
    for (const direction of [0, 2] as const) {
      const groundAt = singleTileNorthSouthRamp(direction, -1);
      const surface = steppedStairSurface(0, 0, direction, groundAt);
      const projected = surface.bands.flatMap((band) => [band.tread, band.riser].flatMap((face) =>
        face ? [{ start: face.y[0] - band.height, end: face.y[1] - band.height }] : []));
      expect(Math.max(...projected.map((face) => face.end)) - Math.min(...projected.map((face) => face.start))).toBeCloseTo(2);
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
        floor: band.floor,
        tread: band.tread,
      }))).toEqual(surface.bands.map((band) => ({
        floor: { x: [band.start, band.end], y: [0, 1] },
        tread: {
          x: direction === 1
            ? [Math.max(band.start, band.end - 0.045), band.end]
            : [band.start, Math.min(band.end, band.start + 0.045)],
          y: [0, 1],
        },
      })));
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
    for (const band of east.bands) expect(band.tread.x[1]).toBe(band.end);
    for (const band of west.bands) expect(band.tread.x[0]).toBe(band.start);
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

    expect(surface.bands.map((band) => band.liftBakePx)).toEqual(
      Array.from({ length: TREAD_COUNT }, (_, index) => index < TREAD_COUNT / 2 ? -16 : 32),
    );
  });
});
