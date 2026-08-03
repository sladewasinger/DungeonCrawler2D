import { describe, expect, it } from "vitest";
import { DESKTOP_TERRAIN_PROFILE, CONSTRAINED_TERRAIN_PROFILE } from "./terrainDeviceProfile.js";
import { clipTerrainBounds, isRoomIsolationView, terrainBoundsForProfile } from "./terrainView.js";
import { worldBoundsForView } from "../runtime/renderSupport.js";

const VIEW = { x: 128, y: 256, width: 640, height: 480 };

describe("terrainBoundsForProfile", () => {
  it("retains the constrained projection margin for raised caps and wall faces", () => {
    const strictBounds = worldBoundsForView(VIEW, 0, 0);
    const constrainedBounds = terrainBoundsForProfile({
      view: VIEW, orientation: 0, profile: CONSTRAINED_TERRAIN_PROFILE,
    });

    expect(constrainedBounds.x).toBeLessThan(strictBounds.x);
    expect(constrainedBounds.y).toBeLessThan(strictBounds.y);
    expect(constrainedBounds.width).toBeGreaterThan(strictBounds.width);
    expect(constrainedBounds.height).toBeGreaterThan(strictBounds.height);
  });

  it("keeps the constrained terrain window no larger than desktop", () => {
    const constrainedBounds = terrainBoundsForProfile({
      view: VIEW, orientation: 0, profile: CONSTRAINED_TERRAIN_PROFILE,
    });
    const desktopBounds = terrainBoundsForProfile({
      view: VIEW, orientation: 0, profile: DESKTOP_TERRAIN_PROFILE,
    });

    expect(constrainedBounds.width).toBeLessThanOrEqual(desktopBounds.width);
    expect(constrainedBounds.height).toBeLessThanOrEqual(desktopBounds.height);
  });

  it("uses the bounded finite admission margin without changing authored-room bounds", () => {
    const finiteBounds = terrainBoundsForProfile({
      view: VIEW, orientation: 0, profile: DESKTOP_TERRAIN_PROFILE, finiteFloor: true,
    });
    const authoredBounds = terrainBoundsForProfile({
      view: VIEW, orientation: 0, profile: DESKTOP_TERRAIN_PROFILE,
    });

    expect(finiteBounds.width).toBeLessThan(authoredBounds.width);
    expect(finiteBounds.height).toBeLessThan(authoredBounds.height);
  });
});

describe("clipTerrainBounds", () => {
  it("returns no terrain work for a view wholly outside the finite floor", () => {
    expect(clipTerrainBounds(
      { x: 100, y: 100, width: 12, height: 12 },
      { minX: -4, minY: -4, maxX: 4, maxY: 4 },
    )).toEqual({ x: 100, y: 100, width: 0, height: 0 });
  });

  it("keeps the isolated authored room plane renderable outside finite bounds", () => {
    expect(isRoomIsolationView({ x: -16, y: 131_072, width: 32, height: 32 })).toBe(true);
    expect(clipTerrainBounds(
      { x: -16, y: 131_072, width: 32, height: 32 },
      { minX: -4, minY: -4, maxX: 4, maxY: 4 },
      true,
    )).toEqual({ x: -16, y: 131_072, width: 32, height: 32 });
  });

  it("clips a boundary view without expanding the finite floor", () => {
    expect(clipTerrainBounds(
      { x: 2, y: 2, width: 8, height: 8 },
      { minX: -4, minY: -4, maxX: 4, maxY: 4 },
    )).toEqual({ x: 2, y: 2, width: 3, height: 3 });
  });
});
