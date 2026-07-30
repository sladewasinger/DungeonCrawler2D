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
    expect(isToonPositionVisible(blocked, 2.5, 0.5)).toBe(false);
  });

  it("does not reveal diagonally around a blocked corner", () => {
    const corner = field(worldWith(new Map(), new Set(["1,0"])));
    expect(isToonPositionVisible(corner, 1.5, 1.5)).toBe(false);
  });

  it("keeps one elevation step visible but hides a ridge that descends again", () => {
    const step = field(worldWith(new Map([["2,0", 1]])));
    const ridge = field(worldWith(new Map([["1,0", 1]])));
    expect(isToonPositionVisible(step, 2.5, 0.5)).toBe(true);
    expect(isToonPositionVisible(ridge, 2.5, 0.5)).toBe(false);
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
    expect(workload.lineOfSightChecks).toBe(4096);
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
