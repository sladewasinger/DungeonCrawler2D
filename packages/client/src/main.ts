// Client entrypoint: wires up the Phaser game and its scene list. Orchestration only — no logic here.
import Phaser from "phaser";
import { installBootErrorOverlay } from "./boot/errorOverlay.js";
import { registerServiceWorker } from "./boot/registerServiceWorker.js";
import { BUILD_SHA } from "./buildInfo.js";
import { PreloadScene } from "./boot/PreloadScene.js";
import { Connection } from "./net/connection.js";
import { persistentClientId } from "./net/identity.js";
import { resolveWsUrl } from "./net/url.js";
import { AutotileGalleryScene } from "./scenes/autotileGallery/AutotileGalleryScene.js";
import { EditorScene, setUpEditorLayout } from "./scenes/editor/index.js";
import { DungeonScene } from "./scenes/dungeon/index.js";
import { GalleryScene } from "./scenes/GalleryScene.js";
import { HudScene } from "./scenes/HudScene.js";
import { TitleScene } from "./scenes/title/index.js";
import { loadStoredName } from "./scenes/title/connectForm.js";
import { getViewOrientation } from "./render/view/index.js";

// Installed before anything else can throw — a boot/runtime failure must render a
// visible message, never a silent black screen (mobile-fix round 2, bug report A).
installBootErrorOverlay(import.meta.env.DEV);
registerServiceWorker(import.meta.env.PROD);

const route = new URLSearchParams(window.location.search);
const isThreeDungeon = route.get("renderer") === "three";
const isEditor = route.get("scene") === "editor";

if (isThreeDungeon) {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root for Three.js renderer.");
  const conn = new Connection(resolveWsUrl(window.location), loadStoredName(), persistentClientId());
  conn.connect();
  void import("./three/ThreeDungeonClient.js").then(({ startThreeDungeon }) => startThreeDungeon({ root, search: route, conn }));
} else if (isEditor) {
  const boot = setUpEditorLayout();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: boot.parentId,
    width: 720,
    height: 720,
    pixelArt: true,
    scene: [PreloadScene, EditorScene],
  });
  game.registry.set("editorBoot", boot);
  // Same dev-only introspection convention as ?debug=1 below — lets screenshot/e2e
  // tooling poll the bench's live state (SIMULATE tick count, painted areas) without
  // scraping pixels.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("debug") === "1") {
    (window as unknown as { __editorStore: typeof boot.store }).__editorStore = boot.store;
    (window as unknown as { __game: Phaser.Game }).__game = game;
    // LANE W3: editor-mode counterpart to the game's window.__dc2d.viewOrientation()
    // read-only hook (LANE W2) — a distinct global since editor mode has no Connection
    // to nest it under, so tests/screenshot tooling can assert the render panel's
    // exact settled orientation without scraping pixels.
    (window as unknown as { __editorViewOrientation: () => number }).__editorViewOrientation = () =>
      getViewOrientation();
  }
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
    // touch: true forces Phaser's own TouchManager on regardless of Phaser.Device's
    // boot-time touch detection — without this, a browser that reports no touch
    // support at page load (e.g. desktop Chrome before the device toolbar is
    // toggled) never gets a TouchManager at all, so no Pointer ever sees a real
    // touch event again for the rest of the session — input/index.ts's late-touch
    // reactivity would be unreachable dead code.
    input: { activePointers: 3, touch: true },
    scene: [PreloadScene, new TitleScene(conn), new DungeonScene(conn), GalleryScene, AutotileGalleryScene, HudScene],
  });
  // Perf/debug introspection, dev-server only (never in a production build):
  // ?debug=1 exposes the game for FPS/display-list probes (tools + manual tuning), and
  // the live Connection for the committed e2e suite (tests/e2e/) to read authoritative
  // client state (hp, inventory, entities, chat, world queries) from — the suite still
  // drives every action through real trusted keyboard/mouse events (Phaser ignores
  // synthetic ones), this is read-only observation, same convention as ?debug=1's
  // window.__editorStore for the effects bench (scenes/editor/index.ts).
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("debug") === "1") {
    (window as unknown as { __game: Phaser.Game }).__game = game;
    (
      window as unknown as {
        __dc2d: { conn: Connection; game: Phaser.Game; buildSha: string; viewOrientation: () => number };
      }
    ).__dc2d = {
      conn,
      game,
      buildSha: BUILD_SHA,
      // LANE W2, read-only observation (same convention as the rest of this hook): the
      // seam's live settled ViewOrientation, for the e2e rotation spec to assert against.
      viewOrientation: () => getViewOrientation(),
    };
  }
}
