/** Selects a renderer before loading either renderer implementation. */
import { installBootErrorOverlay } from "./boot/errorOverlay.js";
import { registerServiceWorker } from "./boot/registerServiceWorker.js";

installBootErrorOverlay(import.meta.env.DEV);
registerServiceWorker(import.meta.env.PROD);

const search = new URLSearchParams(window.location.search);

if (search.get("renderer") === "three") {
  void import("./three/ThreeRoute.js").then(({ startThreeRoute }) => startThreeRoute(search));
} else {
  void import("./phaser/PhaserRoute.js").then(({ startPhaserRoute }) => startPhaserRoute(search));
}
