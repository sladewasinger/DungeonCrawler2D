// Client entrypoint: wires up the Phaser game and its scene list. Orchestration only — no logic here.
import Phaser from "phaser";
import { PreloadScene } from "./boot/PreloadScene.js";
import { BootReadyScene } from "./scenes/BootReadyScene.js";
import { GalleryScene } from "./scenes/GalleryScene.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  pixelArt: true,
  scene: [PreloadScene, BootReadyScene, GalleryScene],
});
