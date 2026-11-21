/** Keeps the 2D dungeon camera's size and world-space coverage in sync with its viewport. */
import Phaser from "phaser";
import { isTouchDevice } from "../../../input/touchDetect.js";
import { DungeonCameraZoomController } from "./viewport/cameraZoomController.js";

export interface DungeonCameraScaleOptions {
  readonly presentationZoom?: () => number;
  readonly mobile?: () => boolean;
}

export const bindDungeonCameraResize = (
  scene: Phaser.Scene,
  controller: DungeonCameraZoomController,
  options: DungeonCameraScaleOptions = {},
): void => {
  const onResize = () => {
    controller.syncPresentation(
      options.presentationZoom?.() ?? 1,
      options.mobile?.() ?? isTouchDevice(),
    );
  };
  onResize();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
};
