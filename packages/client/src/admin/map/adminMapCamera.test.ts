import { describe, expect, it } from "vitest";
import {
  adminMapPointerWorldDelta,
  adminMapScreenPoint,
  adminMapLocationChanged,
  adminMapTileCenter,
  panAdminMapCenter,
  panAdminMapCenterByDelta,
} from "./adminMapCamera.js";

describe("admin map camera", () => {
  it("converts CSS-scaled pointer movement into opposite world-tile movement", () => {
    const canvas = Object.assign(new EventTarget(), {
      width: 800,
      height: 480,
      getBoundingClientRect: () => ({ width: 400, height: 240 }),
    }) as unknown as HTMLCanvasElement;

    const delta = adminMapPointerWorldDelta({
      canvas,
      delta: { x: 20, y: -10 },
      tileSize: 32,
    });

    expect(delta).toEqual({ x: -1.25, y: 0.625 });
    expect(panAdminMapCenterByDelta({ x: 10, y: 20 }, delta)).toEqual({ x: 8.75, y: 20.625 });
  });

  it("centres the camera on the containing tile instead of a tile intersection", () => {
    expect(adminMapTileCenter({ x: 11.8, y: -9.1 })).toEqual({ x: 11.5, y: -9.5 });
  });

  it("pans locally by elapsed animation time", () => {
    expect(panAdminMapCenter({
      center: { x: 10.5, y: 10.5 },
      direction: { x: 1, y: -1 },
      elapsedMs: 500,
      tilesPerSecond: 6,
    })).toEqual({ x: 13.5, y: 7.5 });
  });

  it("retains a local camera while the same map location refreshes", () => {
    const location = { level: "dungeon" as const, floor: 1 };
    expect(adminMapLocationChanged(location, { ...location })).toBe(false);
    expect(adminMapLocationChanged(location, { ...location, floor: 2 })).toBe(true);
  });

  it("projects world positions using the selected editor zoom", () => {
    expect(adminMapScreenPoint({
      world: { x: 12.5, y: 9.5 },
      center: { x: 10.5, y: 10.5 },
      canvas: { width: 480, height: 360 },
      tileSize: 48,
    })).toEqual({ x: 336, y: 132 });
  });
});
