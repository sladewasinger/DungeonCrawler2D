// Client entrypoint: wires up the Phaser game and its scene list. Orchestration only — no logic here.
import Phaser from "phaser";
import { PreloadScene } from "./boot/PreloadScene.js";
import { Connection } from "./net/connection.js";
import { persistentClientId } from "./net/identity.js";
import { resolveWsUrl } from "./net/url.js";
import { EditorScene, setUpEditorLayout } from "./scenes/editor/index.js";
import { DungeonScene } from "./scenes/dungeon/index.js";
import { GalleryScene } from "./scenes/GalleryScene.js";
import { HudScene } from "./scenes/HudScene.js";
import { TitleScene } from "./scenes/title/index.js";
import { loadStoredName } from "./scenes/title/connectForm.js";

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
  // One Connection for the app's whole lifetime — Title and Dungeon share it so a
  // reconnect never loses the in-flight session (net/connection.ts owns its own
  // reconnect-with-backoff; the scenes only react to its onConnected callback).
  const conn = new Connection(resolveWsUrl(window.location), loadStoredName(), persistentClientId());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: 1280,
    height: 720,
    pixelArt: true,
    // RESIZE mode: the HUD widget registry re-anchors on real viewport changes
    // (docs mobile-ish 900x600 check) instead of the canvas staying letterboxed.
    scale: { mode: Phaser.Scale.RESIZE },
    // 3 simultaneous pointers: the touch joystick plus one action button held at
    // once (attack-while-moving) — Phaser tracks only 1 by default (docs mobile pass).
    input: { activePointers: 3 },
    scene: [PreloadScene, new TitleScene(conn), new DungeonScene(conn), GalleryScene, HudScene],
  });
  // Perf/debug introspection, dev-server only (never in a production build):
  // ?debug=1 exposes the game for FPS/display-list probes (tools + manual tuning).
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("debug") === "1") {
    (window as unknown as { __game: Phaser.Game }).__game = game;
  }
}
