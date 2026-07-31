import { describe, expect, it } from "vitest";
import {
  ADMIN_MAP_DEFAULT_TILE_SIZE,
  adminMapViewportRadius,
  adminMapZoomPercent,
  nextAdminMapTileSize,
} from "./adminMapZoom.js";

describe("admin map zoom", () => {
  it("moves in 25 percent steps around the 100 percent default", () => {
    expect(nextAdminMapTileSize(ADMIN_MAP_DEFAULT_TILE_SIZE, "in")).toBe(30);
    expect(nextAdminMapTileSize(ADMIN_MAP_DEFAULT_TILE_SIZE, "out")).toBe(18);
    expect(adminMapZoomPercent(ADMIN_MAP_DEFAULT_TILE_SIZE)).toBe(100);
  });

  it("clamps zoom between 75 and 200 percent", () => {
    expect(nextAdminMapTileSize(18, "out")).toBe(18);
    expect(nextAdminMapTileSize(48, "in")).toBe(48);
  });

  it("bounds map coverage while filling the editor at minimum zoom", () => {
    expect(adminMapViewportRadius({ width: 800, height: 480, tileSize: 18 }))
      .toBe(24);
    expect(adminMapViewportRadius({ width: 800, height: 480, tileSize: 24 }))
      .toBe(18);
  });
});
