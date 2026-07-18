// Client entrypoint: boots the Phaser game against the placeholder BootScene.
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  pixelArt: true,
  scene: [BootScene],
});
