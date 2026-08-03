import { describe, expect, it } from "vitest";
import tuning from "./terrainRuntimeTuning.json" with { type: "json" };
import { TERRAIN_RUNTIME_TUNING } from "./terrainRuntimeTuning.js";

describe("terrain runtime tuning", () => {
  it("exposes the configured camera policy without replacing authored values", () => {
    expect(TERRAIN_RUNTIME_TUNING.cameraPresentation)
      .toEqual(tuning.cameraPresentation);
    expect(TERRAIN_RUNTIME_TUNING.cameraPresentation.finiteTerrainMarginTiles)
      .toBeGreaterThan(0);
  });

  it("provides a coherent validated camera presentation range", () => {
    const camera = TERRAIN_RUNTIME_TUNING.cameraPresentation;
    const referenceAspect = camera.referenceViewport.width / camera.referenceViewport.height;
    expect(Number.isInteger(camera.referenceViewport.width)).toBe(true);
    expect(Number.isInteger(camera.referenceViewport.height)).toBe(true);
    expect(camera.baseZoom).toBeGreaterThan(0);
    expect(camera.minimumAspectRatio).toBeLessThan(referenceAspect);
    expect(camera.maximumAspectRatio).toBeGreaterThan(referenceAspect);
    expect(camera.spectator.minimumZoom).toBeLessThanOrEqual(camera.spectator.maximumZoom);
    expect(camera.spectator.zoomStep).toBeGreaterThan(0);
  });

  it("keeps mobile HUD and diagnostic sampling bounded", () => {
    const mobile = TERRAIN_RUNTIME_TUNING.mobilePerformance;
    expect(mobile.compassUpdatesPerSecond).toBeGreaterThanOrEqual(10);
    expect(mobile.telemetryUpdatesPerSecond).toBeGreaterThanOrEqual(2);
    expect(mobile.diagnosticSampleSeconds).toBeGreaterThan(0);
    expect(mobile.diagnosticMaxSamples).toBeGreaterThan(0);
  });
});
