import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { VIEW_ORIENTATIONS } from "../../render/view/viewOrientation.js";
import { editorCameraLayout } from "./editorCameraLayout.js";

describe("editorCameraLayout", () => {
  it("renders terrain at the gameplay camera scale", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      const layout = editorCameraLayout(orientation);
      expect(layout.zoom).toBe(1);
      expect(SCREEN_TILE_PX * layout.zoom).toBe(48);
    }
  });

  it("centers the rotated island without changing its scale", () => {
    expect(editorCameraLayout(0)).toEqual({ centerX: 480, centerY: 480, zoom: 1 });
    expect(editorCameraLayout(90)).toEqual({ centerX: 480, centerY: -480, zoom: 1 });
    expect(editorCameraLayout(180)).toEqual({ centerX: -480, centerY: -480, zoom: 1 });
    expect(editorCameraLayout(270)).toEqual({ centerX: -480, centerY: 480, zoom: 1 });
  });
});
