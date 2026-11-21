import Phaser from "phaser";
import { PreloadScene } from "../boot/PreloadScene.js";
import { getViewOrientation } from "../render/view/index.js";
import { EditorScene, setUpEditorLayout } from "../scenes/editor/index.js";

export function startEditorPhaserRoute(): void {
  const boot = setUpEditorLayout();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: boot.parentId,
    width: 960,
    height: 960,
    pixelArt: true,
    disableContextMenu: true,
    scene: [new PreloadScene("editor"), EditorScene],
  });
  game.registry.set("editorBoot", boot);
  game.events?.once?.(Phaser.Core.Events.DESTROY, () => boot.dispose());
  exposeEditorDebugState(game);
}

function exposeEditorDebugState(game: Phaser.Game): void {
  const search = new URLSearchParams(window.location.search);
  if (!import.meta.env.DEV || search.get("debug") !== "1") return;
  const debugWindow = window as unknown as EditorDebugWindow;
  debugWindow.__game = game;
  debugWindow.__editorViewOrientation = getViewOrientation;
}

interface EditorDebugWindow {
  __game: Phaser.Game;
  __editorViewOrientation: typeof getViewOrientation;
}
