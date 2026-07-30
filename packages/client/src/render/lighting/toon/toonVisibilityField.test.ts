import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { worldTileToView } from "../../view/transform/viewTransform.js";
import {
  buildToonVisibilityField,
  isToonPositionVisible,
  type ToonVisibilityWorld,
} from "./toonVisibilityField.js";

function worldWith(
  heights: ReadonlyMap<string, number> = new Map(),
  blocked: ReadonlySet<string> = new Set(),
): ToonVisibilityWorld {
  const groundAt = (x: number, y: number) =>
    heights.get(`${Math.floor(x)},${Math.floor(y)}`) ?? 0;
  return {
    groundAt,
    heightAt: groundAt,
    isWalkable: (x, y) => !blocked.has(`${Math.floor(x)},${Math.floor(y)}`),
    stairHeightAt: () => null,
    tileRevision: 1,
  };
}

function field(
  world: ToonVisibilityWorld,
  orientation: ViewOrientation = 0,
) {
  return buildToonVisibilityField({
    world,
    player: { x: 0.5, y: 0.5 },
    bounds: { x: -2, y: -2, width: 7, height: 7 },
    orientation,
  });
}

describe("toon visibility field", () => {
  it("reveals clear terrain but does not reveal through a wall", () => {
    const clear = field(worldWith());
    const blocked = field(worldWith(new Map(), new Set(["1,0"])));
    expect(isToonPositionVisible(clear, 2.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(blocked, 1.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(blocked, 2.5, 0.5)).toBe(false);
  });

  it("reveals a blocking wall within one level and hides terrain behind it", () => {
    const wall = field(worldWith(
      new Map([["1,0", 1]]),
      new Set(["1,0"]),
    ));

    expect(isToonPositionVisible(wall, 1.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(wall, 2.5, 0.5)).toBe(false);
  });

  it("does not reveal a wall past an elevation reversal", () => {
    const hiddenWall = field(worldWith(
      new Map([["1,0", 1]]),
      new Set(["2,0"]),
    ));

    expect(isToonPositionVisible(hiddenWall, 1.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(hiddenWall, 2.5, 0.5)).toBe(false);
  });

  it("does not reveal diagonally around a blocked corner", () => {
    const corner = field(worldWith(new Map(), new Set(["1,0"])));
    expect(isToonPositionVisible(corner, 1.5, 1.5)).toBe(false);
  });

  it("continues sight after one elevation transition but hides a ridge", () => {
    const raised = field(worldWith(new Map([
      ["1,0", 1],
      ["2,0", 1],
      ["3,0", 1],
    ])));
    const lowered = field(worldWith(new Map([
      ["0,0", -1],
      ["1,0", 0],
      ["2,0", 0],
      ["3,0", 0],
    ])));
    const ridge = field(worldWith(new Map([["1,0", 1]])));
    expect(isToonPositionVisible(raised, 3.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(lowered, 3.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(ridge, 2.5, 0.5)).toBe(false);
  });

  it("projects a visible pit floor at its lowered screen position", () => {
    const pit = field(worldWith(new Map([
      ["0,0", -1],
      ["1,0", -1],
    ])));
    const viewTile = worldTileToView({ x: 1, y: 0 }, 0);

    expect(isToonPositionVisible(pit, 1.5, 0.5)).toBe(true);
    expect(maskIncludes(pit.maskRects, viewTile.x, viewTile.y + 1)).toBe(true);
    expect(maskIncludes(pit.maskRects, viewTile.x, viewTile.y)).toBe(false);
  });

  it("projects every orientation through the terrain world-to-view seam", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      const projected = field(worldWith(), orientation);
      const viewTile = worldTileToView({ x: 2, y: 1 }, orientation);
      expect(isToonPositionVisible(projected, 2.5, 1.5)).toBe(true);
      expect(maskIncludes(projected.maskRects, viewTile.x, viewTile.y)).toBe(true);
    }
  });

  it("enforces the deterministic per-rebuild LOS workload budget", () => {
    const workload = buildToonVisibilityField({
      world: worldWith(),
      player: { x: 0.5, y: 0.5 },
      bounds: { x: -64, y: -64, width: 128, height: 128 },
      orientation: 0,
    });
    expect(workload.evaluatedCells).toBe(4096);
    expect(workload.lineOfSightChecks).toBeGreaterThan(0);
    expect(workload.lineOfSightChecks).toBeLessThanOrEqual(4096);
    expect(workload.occluderChecks).toBeLessThanOrEqual(4096);
  });
});

function maskIncludes(
  rects: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  viewX: number,
  viewY: number,
): boolean {
  const x = viewX * SCREEN_TILE_PX;
  const y = viewY * SCREEN_TILE_PX;
  return rects.some((rect) =>
    x >= rect.x && x < rect.x + rect.width &&
    y >= rect.y && y < rect.y + rect.height,
  );
}
