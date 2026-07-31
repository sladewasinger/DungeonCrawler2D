import Phaser from "phaser";
import { PreloadScene } from "../boot/PreloadScene.js";
import { Connection } from "../net/connection/connection.js";
import { resolveWsUrl } from "../net/connection/url.js";
import { SpectatorControls } from "./spectatorControls.js";
import { SpectatorScene } from "./spectatorScene.js";
import "./spectator.css";

export function startSpectatorRoute(search: URLSearchParams): void {
  const mode = search.get("mode") === "track" ? "track" : "free";
  const embedded = search.get("embed") === "admin";
  const hudVisible = search.get("hud") !== "0" && !embedded;
  const target = search.get("target") ?? undefined;
  const connection = new Connection(
    resolveWsUrl(window.location),
    "Spectator",
    spectatorClientId(),
  );
  const scene = new SpectatorScene(connection, hudVisible);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: 1280,
    height: 720,
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [PreloadScene, scene],
  });
  game.registry.set("startupScene", "spectator-dungeon");
  const controls = new SpectatorControls({
    connection,
    setHudVisible: (visible) => scene.setHudVisible(visible),
    focusCamera: () => scene.focusCamera(),
    centerCamera: () => scene.centerCamera(),
    hudVisible,
    embedded,
  });
  connection.connectSpectator(mode, target);
  bindSpectatorCleanup(connection, controls);
}

function bindSpectatorCleanup(
  connection: Connection,
  controls: SpectatorControls,
): void {
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    controls.dispose();
    connection.disconnect();
  };
  window.addEventListener("pagehide", dispose, { once: true });
  window.addEventListener("beforeunload", dispose, { once: true });
}

function spectatorClientId(): string {
  return `spectator-${globalThis.crypto?.randomUUID?.() ?? randomSuffix()}`;
}

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
