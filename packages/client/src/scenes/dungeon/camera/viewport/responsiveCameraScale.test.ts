import { describe, expect, it } from "vitest";
import { TERRAIN_RUNTIME_TUNING } from "../../../../render/terrain/terrainRuntimeTuning.js";
import {
  GAMEPLAY_BASE_CAMERA_ZOOM,
  boundedGameplayCameraViewport,
  responsiveGameplayCameraZoom,
  viewportScale,
} from "./responsiveCameraScale.js";

describe("responsive gameplay camera scale", () => {
  const camera = TERRAIN_RUNTIME_TUNING.cameraPresentation;
  const reference = camera.referenceViewport;

  it("preserves the reference world coverage at ordinary desktop sizes", () => {
    expect(responsiveGameplayCameraZoom(reference))
      .toBe(GAMEPLAY_BASE_CAMERA_ZOOM);
    expect(responsiveGameplayCameraZoom(scaledViewport(reference, 1.6)))
      .toBe(GAMEPLAY_BASE_CAMERA_ZOOM * 1.6);
  });

  it("uses the bounded viewport's short axis so embedded and mobile views zoom out", () => {
    expect(viewportScale(scaledViewport(reference, 0.5))).toBe(0.5);
    const tall = { width: reference.width * 0.5, height: reference.height * 2 };
    expect(viewportScale(tall)).toBeCloseTo(0.5);
  });

  it("keeps spectator presentation zoom multiplicative over the baseline", () => {
    expect(responsiveGameplayCameraZoom(scaledViewport(reference, 0.5), 0.5))
      .toBe(GAMEPLAY_BASE_CAMERA_ZOOM * 0.25);
  });

  it("centers pillarbox bars beyond the configured maximum aspect", () => {
    const height = reference.height * 2;
    const boundedWidth = height * camera.maximumAspectRatio;
    const viewport = { width: boundedWidth + 1000, height };
    expect(boundedGameplayCameraViewport(viewport))
      .toEqual({ x: 500, y: 0, width: boundedWidth, height });
    expect(worldCoverage(viewport)).toEqual(worldCoverage({ width: boundedWidth, height }));
  });

  it("centers letterbox bars below the configured minimum aspect", () => {
    const width = reference.width;
    const boundedHeight = width / camera.minimumAspectRatio;
    const viewport = { width, height: boundedHeight + 500 };
    expect(boundedGameplayCameraViewport(viewport))
      .toEqual({ x: 0, y: 250, width, height: boundedHeight });
    expect(worldCoverage(viewport)).toEqual(worldCoverage({ width, height: boundedHeight }));
  });

  it("preserves world coverage under proportional browser zoom changes", () => {
    const normal = worldCoverage(reference);
    expect(worldCoverage(scaledViewport(reference, 2))).toEqual(normal);
    expect(worldCoverage(scaledViewport(reference, 4))).toEqual(normal);
  });

  it("still prevents pathological tiny viewports from expanding coverage", () => {
    expect(viewportScale({ width: 1, height: 1 })).toBe(0.25);
  });
});

function worldCoverage(viewport: { readonly width: number; readonly height: number }) {
  const bounded = boundedGameplayCameraViewport(viewport);
  const zoom = responsiveGameplayCameraZoom(viewport);
  return { width: bounded.width / zoom, height: bounded.height / zoom };
}

function scaledViewport(
  viewport: { readonly width: number; readonly height: number },
  scale: number,
) {
  return { width: viewport.width * scale, height: viewport.height * scale };
}
