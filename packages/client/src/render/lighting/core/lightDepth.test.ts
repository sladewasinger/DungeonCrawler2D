import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { depthForOccluder } from "../../entities/presentation/depthSort.js";
import { lightOverlayDepth } from "./lightDepth.js";

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
});
