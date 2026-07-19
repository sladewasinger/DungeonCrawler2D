// Client entrypoint: wires up the Phaser game and its scene list. Orchestration only — no logic here.
import Phaser from "phaser";
import { PreloadScene } from "./boot/PreloadScene.js";
import { BootReadyScene } from "./scenes/BootReadyScene.js";
import { EditorScene, setUpEditorLayout } from "./scenes/editor/index.js";
import { GalleryScene } from "./scenes/GalleryScene.js";

const isEditor = new URLSearchParams(window.location.search).get("scene") === "editor";

if (isEditor) {
  const boot = setUpEditorLayout();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: boot.parentId,
    width: 720,
    height: 720,
    pixelArt: true,
    scene: [PreloadScene, EditorScene],
  });
  game.registry.set("editorBoot", { store: boot.store });
} else {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: 1280,
    height: 720,
    pixelArt: true,
    scene: [PreloadScene, BootReadyScene, GalleryScene],
  });
}
