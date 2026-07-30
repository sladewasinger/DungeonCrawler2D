import { describe, expect, it } from "vitest";
import { selectTerrainDeviceProfile, type TerrainDeviceSignals } from "./terrainDeviceProfile.js";

const DESKTOP: TerrainDeviceSignals = {
  viewportWidth: 1920,
  viewportHeight: 1080,
  devicePixelRatio: 1,
  maxTouchPoints: 0,
  coarsePointer: false,
  finePointer: true,
  mobilePlatform: false,
  logicalProcessorCount: 8,
  deviceMemoryGiB: 8,
  maxTextureSize: 8192,
};

describe("terrain device profiles", () => {
  it("keeps desktop terrain below a 192 MiB active-plus-spare ceiling", () => {
    const profile = selectTerrainDeviceProfile(DESKTOP);
    expect(profile.kind).toBe("desktop");
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.visuals)).toBe(true);
    expect(Object.isFrozen(profile.retention)).toBe(true);
    expect(profile.activeBytes + profile.spareBytes).toBe(192 * 1024 * 1024);
    expect(profile.terrainMarginTiles).toBe(2);
    expect(profile.lightLoadMarginChunks).toBe(1);
    expect(profile.visuals).toEqual({
      ambientOcclusion: true,
      biomeTint: true,
      bedrockTint: true,
      cliffHighlights: true,
    });
  });

  it("keeps capable touch-enabled desktops on the desktop profile", () => {
    const profile = selectTerrainDeviceProfile({ ...DESKTOP, maxTouchPoints: 5 });
    expect(profile.kind).toBe("desktop");
  });

  it("uses the constrained profile for a real phone", () => {
    const profile = selectTerrainDeviceProfile({
      ...DESKTOP,
      viewportWidth: 390,
      viewportHeight: 844,
      devicePixelRatio: 3,
      maxTouchPoints: 5,
      coarsePointer: true,
      finePointer: false,
      mobilePlatform: true,
    });
    expect(profile.kind).toBe("constrained");
    expect(profile.activeBytes + profile.spareBytes).toBe(96 * 1024 * 1024);
    expect(profile.terrainMarginTiles).toBe(2);
    expect(profile.lightLoadMarginChunks).toBe(1);
    expect(profile.retention.maxChunkPlans)
      .toBeLessThan(selectTerrainDeviceProfile(DESKTOP).retention.maxChunkPlans);
    expect(profile.retention.maxWorldChunks)
      .toBeLessThan(selectTerrainDeviceProfile(DESKTOP).retention.maxWorldChunks);
    expect(profile.visuals).toEqual({
      ambientOcclusion: false,
      biomeTint: false,
      bedrockTint: true,
      cliffHighlights: true,
    });
  });

  it("uses combined pressure signals for constrained non-phone devices", () => {
    expect(selectTerrainDeviceProfile({ ...DESKTOP, logicalProcessorCount: 4 }).kind)
      .toBe("desktop");
    expect(selectTerrainDeviceProfile({ ...DESKTOP, deviceMemoryGiB: 4 }).kind)
      .toBe("desktop");
    expect(selectTerrainDeviceProfile({
      ...DESKTOP,
      logicalProcessorCount: 4,
      deviceMemoryGiB: 4,
    }).kind).toBe("constrained");
    expect(selectTerrainDeviceProfile({ ...DESKTOP, maxTextureSize: 2048 }).kind).toBe("constrained");
    expect(selectTerrainDeviceProfile({
      ...DESKTOP,
      viewportWidth: 900,
      viewportHeight: 500,
      devicePixelRatio: 3,
      maxTouchPoints: 5,
      coarsePointer: true,
      finePointer: false,
    }).kind).toBe("constrained");
  });
});
