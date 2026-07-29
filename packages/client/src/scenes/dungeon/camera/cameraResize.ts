/** Keeps the 2D dungeon camera sized to the Phaser viewport for the scene lifetime. */
import Phaser from "phaser";

export const bindDungeonCameraResize = (scene: Phaser.Scene): void => {
  const onResize = (gameSize: Phaser.Structs.Size) =>
    scene.cameras.main.setSize(gameSize.width, gameSize.height);
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize));
};
