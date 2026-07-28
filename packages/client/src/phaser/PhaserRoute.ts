/** Boots the Phaser editor or game only after the route selects the 2D renderer. */
import Phaser from "phaser";
import { PreloadScene } from "../boot/PreloadScene.js";
import { bindVersionRefreshOverlay } from "../boot/versionRefreshOverlay.js";
import { BUILD_SHA } from "../buildInfo.js";
import { Connection } from "../net/connection/connection.js";
import { persistentClientId } from "../net/auth/identity.js";
import { resolveWsUrl } from "../net/connection/url.js";
import { getViewOrientation } from "../render/view/index.js";
import { DungeonScene } from "../scenes/dungeon/orchestration/index.js";
import { EditorScene, setUpEditorLayout } from "../scenes/editor/index.js";
import { HudScene } from "../scenes/HudScene.js";
import { TitleScene } from "../scenes/title/index.js";
import { loadStoredName } from "../scenes/title/connectForm.js";
import { CharacterVfxTestbench } from "../scenes/testbench/characterVfxTestbench.js";
import { installPhaserFullscreenRetry } from "./mobileFullscreen.js";

export function startPhaserRoute(search: URLSearchParams): void {
  if (search.get("scene") === "editor") startEditor(search);
  else startGame(search);
}

function startEditor(search: URLSearchParams): void {
  const boot = setUpEditorLayout();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: boot.parentId,
    width: 960,
    height: 960,
    pixelArt: true,
    disableContextMenu: true,
    scene: [PreloadScene, EditorScene],
  });
  game.registry.set("editorBoot", boot);
  if (!import.meta.env.DEV || search.get("debug") !== "1") return;
  const debugWindow = window as unknown as EditorDebugWindow;
  debugWindow.__game = game;
  debugWindow.__editorViewOrientation = getViewOrientation;
}

function startGame(search: URLSearchParams): void {
  const conn = new Connection(resolveWsUrl(window.location), loadStoredName(), persistentClientId());
  bindVersionRefreshOverlay(conn);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: 1280,
    height: 720,
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    input: { activePointers: 3, touch: true },
    scene: [PreloadScene, new TitleScene(conn), new DungeonScene(conn), new CharacterVfxTestbench(), HudScene],
  });
  installPhaserFullscreenRetry(game.canvas);
  if (!import.meta.env.DEV || search.get("debug") !== "1") return;
  const debugWindow = window as unknown as GameDebugWindow;
  debugWindow.__game = game;
  debugWindow.__dc2d = {
    conn,
    game,
    buildSha: BUILD_SHA,
    viewOrientation: getViewOrientation,
  };
}

interface EditorDebugWindow {
  __game: Phaser.Game;
  __editorViewOrientation: typeof getViewOrientation;
}

interface GameDebugWindow {
  __game: Phaser.Game;
  __dc2d: {
    conn: Connection;
    game: Phaser.Game;
    buildSha: string;
    viewOrientation: typeof getViewOrientation;
  };
}
