import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { depthForOccluder } from "../../entities/presentation/depthSort.js";
import {
  DARKNESS_OVERLAY_DEPTH,
  lightOverlayDepth,
  LUMINOUS_SOURCE_PARTICLE_DEPTH,
} from "./lightDepth.js";

describe("lightOverlayDepth", () => {
  it("stays above visible terrain at ordinary and reserved room coordinates", () => {
    for (const y of [0, 4096 * 32 * SCREEN_TILE_PX]) {
      const view = {
        x: 0,
        y,
        width: 20 * SCREEN_TILE_PX,
        height: 12 * SCREEN_TILE_PX,
      };
      const lastVisibleRow = (view.y + view.height) / SCREEN_TILE_PX;
      expect(lightOverlayDepth(view))
        .toBeGreaterThan(depthForOccluder(lastVisibleRow));
    }
  });

  it("stays above fixed-depth world particles at ordinary coordinates", () => {
    expect(lightOverlayDepth({
      x: 0,
      y: 0,
      width: 20 * SCREEN_TILE_PX,
      height: 12 * SCREEN_TILE_PX,
    })).toBe(DARKNESS_OVERLAY_DEPTH);
  });

  it("keeps only luminous source particles above the darkness overlay", () => {
    expect(LUMINOUS_SOURCE_PARTICLE_DEPTH)
      .toBeGreaterThan(DARKNESS_OVERLAY_DEPTH);
    expect(LUMINOUS_SOURCE_PARTICLE_DEPTH).toBeLessThan(500_000);
  });
});
