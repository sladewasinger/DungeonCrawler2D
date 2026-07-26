import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { VIEW_ORIENTATIONS } from "../../render/view/viewOrientation.js";
import { worldTileToView } from "../../render/view/viewTransform.js";
import { EDITOR_GRID_SIZE } from "./EditableWorld.js";
import { EDITOR_RENDER_VIEWPORT_PX, editorCameraLayout } from "./editorCameraLayout.js";

describe("editorCameraLayout", () => {
  it("renders terrain at the gameplay camera scale", () => {
    expect(EDITOR_RENDER_VIEWPORT_PX).toBe(960);
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

  it("keeps every rotated editable tile inside the 960px viewport", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      const layout = editorCameraLayout(orientation);
      const cameraLeft = layout.centerX - EDITOR_RENDER_VIEWPORT_PX / 2;
      const cameraTop = layout.centerY - EDITOR_RENDER_VIEWPORT_PX / 2;
      for (let y = 0; y < EDITOR_GRID_SIZE; y++) {
        for (let x = 0; x < EDITOR_GRID_SIZE; x++) {
          const view = worldTileToView({ x, y }, orientation);
          const screenX = view.x * SCREEN_TILE_PX - cameraLeft;
          const screenY = view.y * SCREEN_TILE_PX - cameraTop;
          expect(screenX).toBeGreaterThanOrEqual(0);
          expect(screenY).toBeGreaterThanOrEqual(0);
          expect(screenX + SCREEN_TILE_PX).toBeLessThanOrEqual(EDITOR_RENDER_VIEWPORT_PX);
          expect(screenY + SCREEN_TILE_PX).toBeLessThanOrEqual(EDITOR_RENDER_VIEWPORT_PX);
        }
      }
    }
  });
});
