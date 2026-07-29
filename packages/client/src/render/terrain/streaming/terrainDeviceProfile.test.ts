import { describe, expect, it } from "vitest";
import { selectTerrainDeviceProfile, type TerrainDeviceSignals } from "./terrainDeviceProfile.js";

const DESKTOP: TerrainDeviceSignals = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  devicePixelRatio: 1,
  maxTouchPoints: 0,
  deviceMemoryGiB: 8,
  maxTextureSize: 8192,
};

describe("terrain device profiles", () => {
  it("keeps desktop terrain below a 192 MiB active-plus-spare ceiling", () => {
    const profile = selectTerrainDeviceProfile(DESKTOP);
    expect(profile.kind).toBe("desktop");
    expect(profile.activeBytes + profile.spareBytes).toBe(192 * 1024 * 1024);
    expect(profile.loadMarginChunks).toBe(1);
  });

  it("uses no chunk preload margin and a 96 MiB ceiling on touch devices", () => {
    const profile = selectTerrainDeviceProfile({ ...DESKTOP, maxTouchPoints: 5 });
    expect(profile.kind).toBe("constrained");
    expect(profile.activeBytes + profile.spareBytes).toBe(96 * 1024 * 1024);
    expect(profile.loadMarginChunks).toBe(0);
  });

  it("considers memory, texture limits, viewport size, and pixel density", () => {
    expect(selectTerrainDeviceProfile({ ...DESKTOP, deviceMemoryGiB: 4 }).kind).toBe("constrained");
    expect(selectTerrainDeviceProfile({ ...DESKTOP, maxTextureSize: 2048 }).kind).toBe("constrained");
    expect(selectTerrainDeviceProfile({
      ...DESKTOP,
      viewportWidth: 900,
      viewportHeight: 500,
      devicePixelRatio: 3,
    }).kind).toBe("constrained");
  });
});
