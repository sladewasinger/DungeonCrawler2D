/** Selects a renderer before loading either renderer implementation. */
import { installBootErrorOverlay } from "./boot/errorOverlay.js";
import { registerServiceWorker } from "./boot/registerServiceWorker.js";
import { installGameDomPolicy } from "./ui/foundation/gameDomPolicy.js";

installBootErrorOverlay(import.meta.env.DEV);
registerServiceWorker(import.meta.env.PROD);

const search = new URLSearchParams(window.location.search);
const adminRoute = window.location.pathname === "/admin" || search.get("admin") === "1";
const spectatorRoute = window.location.pathname === "/spectate" || search.get("spectate") === "1";

if (adminRoute) {
  void import("./admin/adminRoute.js").then(({ startAdminRoute }) => startAdminRoute());
} else if (spectatorRoute) {
  installGameDomPolicy();
  void import("./spectator/spectatorRoute.js")
    .then(({ startSpectatorRoute }) => startSpectatorRoute(search));
} else {
  installGameDomPolicy();

  if (search.get("renderer") === "three") {
    void import("./three/client/ThreeRoute.js").then(({ startThreeRoute }) => startThreeRoute(search));
  } else {
    void import("./phaser/PhaserRoute.js").then(({ startPhaserRoute }) => startPhaserRoute(search));
  }
}
