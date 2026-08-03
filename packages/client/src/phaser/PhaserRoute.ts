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
import { HudScene } from "../scenes/HudScene.js";
import { TitleScene } from "../scenes/title/index.js";
import { loadStoredName } from "../scenes/title/connectForm.js";
import { CharacterVfxTestbench } from "../scenes/testbench/characterVfxTestbench.js";
import { installPhaserFullscreenRetry } from "./mobileFullscreen.js";

export function startPhaserRoute(search: URLSearchParams): void {
  startGame(search);
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
    scene: [new PreloadScene(), new TitleScene(conn), new DungeonScene(conn), new CharacterVfxTestbench(), HudScene],
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

interface GameDebugWindow {
  __game: Phaser.Game;
  __dc2d: {
    conn: Connection;
    game: Phaser.Game;
    buildSha: string;
    viewOrientation: typeof getViewOrientation;
  };
}
