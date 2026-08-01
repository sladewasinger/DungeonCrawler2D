/** Keeps the 2D dungeon camera's size and world-space coverage in sync with its viewport. */
import Phaser from "phaser";
import { DungeonCameraZoomController } from "./viewport/cameraZoomController.js";

export interface DungeonCameraScaleOptions {
  readonly presentationZoom?: () => number;
}

export const bindDungeonCameraResize = (
  scene: Phaser.Scene,
  controller: DungeonCameraZoomController,
  options: DungeonCameraScaleOptions = {},
): void => {
  const onResize = () => {
    controller.syncPresentation(options.presentationZoom?.() ?? 1);
  };
  onResize();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
};
