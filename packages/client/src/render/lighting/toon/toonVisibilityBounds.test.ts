import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import { toonWorldBoundsForView } from "./toonVisibilityBounds.js";

describe("toon visibility bounds", () => {
  it("covers the camera footprint through every view orientation", () => {
    const view = {
      x: 3 * SCREEN_TILE_PX,
      y: -2 * SCREEN_TILE_PX,
      width: 7 * SCREEN_TILE_PX,
      height: 5 * SCREEN_TILE_PX,
    };
    for (const orientation of VIEW_ORIENTATIONS) {
      const bounds = toonWorldBoundsForView(view, orientation);
      const center = viewTileToWorld({ x: 6, y: 0 }, orientation);
      expect(center.x).toBeGreaterThanOrEqual(bounds.x);
      expect(center.x).toBeLessThan(bounds.x + bounds.width);
      expect(center.y).toBeGreaterThanOrEqual(bounds.y);
      expect(center.y).toBeLessThan(bounds.y + bounds.height);
    }
  });
});
