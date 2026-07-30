import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import {
  conservativeToonMaskPaths,
  type ToonMaskTile,
} from "./maskGeometry.js";

describe("conservative Toon mask contours", () => {
  it("replaces a uniform outward staircase with one inward diagonal", () => {
    const paths = conservativeToonMaskPaths(lShape([0, 0, 0]));

    expect(paths).toHaveLength(1);
    expect(paths?.[0]?.points).toContainEqual({
      x: 2 * SCREEN_TILE_PX,
      y: 0,
    });
    expect(paths?.[0]?.points).toContainEqual({
      x: 0,
      y: 2 * SCREEN_TILE_PX,
    });
    expect(hasDiagonal(paths?.[0]?.points ?? [])).toBe(true);
  });

  it("keeps a staircase rectilinear across an elevation transition", () => {
    const paths = conservativeToonMaskPaths(lShape([0, 1, 0]));

    expect(paths).toHaveLength(1);
    expect(hasDiagonal(paths?.[0]?.points ?? [])).toBe(false);
  });

  it("falls back to pixel-exact rectangles for fractional elevations", () => {
    const tiles = lShape([0, 0, 0]);
    const first = tiles[0] as ToonMaskTile;
    tiles[0] = {
      ...first,
      topY: first.topY + SCREEN_TILE_PX / 2,
      height: SCREEN_TILE_PX / 2,
    };

    expect(conservativeToonMaskPaths(tiles)).toBeNull();
  });

  it("falls back to exact rectangles when the visible field has a hole", () => {
    const cells = [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ] as const;

    expect(conservativeToonMaskPaths(cells.map(([x, y]) =>
      tile(x, y, 0)))).toBeNull();
  });
});

function lShape(heights: readonly number[]): ToonMaskTile[] {
  return [[0, 0], [1, 0], [0, 1]].map(([x, y], index) =>
    tile(x as number, y as number, heights[index] ?? 0));
}

function tile(x: number, y: number, groundHeight: number): ToonMaskTile {
  return {
    viewX: x * SCREEN_TILE_PX,
    topY: y * SCREEN_TILE_PX,
    height: SCREEN_TILE_PX,
    groundHeight,
  };
}

function hasDiagonal(
  points: readonly { readonly x: number; readonly y: number }[],
): boolean {
  return points.some((point, index) => {
    const next = points[(index + 1) % points.length];
    return next !== undefined && next.x !== point.x && next.y !== point.y;
  });
}
