/** Selects a renderer before loading either renderer implementation. */
import { installBootErrorOverlay } from "./boot/errorOverlay.js";
import { registerServiceWorker } from "./boot/registerServiceWorker.js";
import { installGameDomPolicy } from "./ui/foundation/gameDomPolicy.js";

installBootErrorOverlay(import.meta.env.DEV);
installGameDomPolicy();
registerServiceWorker(import.meta.env.PROD);

const search = new URLSearchParams(window.location.search);

if (search.get("renderer") === "three") {
  void import("./three/client/ThreeRoute.js").then(({ startThreeRoute }) => startThreeRoute(search));
} else {
  void import("./phaser/PhaserRoute.js").then(({ startPhaserRoute }) => startPhaserRoute(search));
}
