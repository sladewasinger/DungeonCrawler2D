import { describe, expect, it } from "vitest";
import {
  adminMapLocationChanged,
  adminMapTileCenter,
  panAdminMapCenter,
} from "./adminMapCamera.js";

describe("admin map camera", () => {
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
});
