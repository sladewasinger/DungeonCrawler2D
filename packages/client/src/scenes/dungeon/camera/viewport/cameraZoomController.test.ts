import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { HIT_STOP_ZOOM } from "../../../../vfx/combat/camera/hitStop.js";
import { DungeonCameraZoomController } from "./cameraZoomController.js";

describe("DungeonCameraZoomController", () => {
  it("restores the latest resized baseline after a kill punch", () => {
    const harness = cameraHarness(1280, 720);
    const controller = new DungeonCameraZoomController(harness.scene);
    controller.syncPresentation();
    harness.scale.width = 2560;
    harness.scale.height = 1440;
    controller.syncPresentation();
    controller.setKillPunchMultiplier(HIT_STOP_ZOOM);
    controller.setKillPunchMultiplier(1);

    expect(harness.setZoom).toHaveBeenLastCalledWith(2);
  });

  it("uses the resized baseline during an active punch", () => {
    const harness = cameraHarness(1280, 720);
    const controller = new DungeonCameraZoomController(harness.scene);
    controller.syncPresentation();
    controller.setKillPunchMultiplier(HIT_STOP_ZOOM);
    harness.scale.width = 640;
    harness.scale.height = 360;
    controller.syncPresentation();

    expect(harness.setZoom).toHaveBeenLastCalledWith(0.5 * HIT_STOP_ZOOM);
  });

  it("keeps spectator presentation zoom multiplicative through a punch", () => {
    const harness = cameraHarness(1280, 720);
    const controller = new DungeonCameraZoomController(harness.scene);
    controller.syncPresentation(0.5);
    controller.setKillPunchMultiplier(HIT_STOP_ZOOM);

    expect(harness.setZoom).toHaveBeenLastCalledWith(0.5 * HIT_STOP_ZOOM);
  });
});

function cameraHarness(width: number, height: number) {
  const setZoom = vi.fn();
  const scene = {
    scale: { width, height },
    cameras: { main: { setViewport: vi.fn(), setZoom } },
  };
  return {
    scene: scene as unknown as Phaser.Scene,
    scale: scene.scale,
    setZoom,
  };
}
