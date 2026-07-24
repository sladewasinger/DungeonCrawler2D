/** Boots the Three.js renderer only after the route selects first-person mode. */
import { Connection } from "../net/connection.js";
import { bindVersionRefreshOverlay } from "../boot/versionRefreshOverlay.js";
import { persistentClientId } from "../net/identity.js";
import { resolveWsUrl } from "../net/url.js";
import { loadStoredName } from "../scenes/title/connectForm.js";
import { StandaloneTitle } from "../scenes/title/standaloneTitle.js";
import { startThreeDungeon } from "./ThreeDungeonClient.js";

export function startThreeRoute(search: URLSearchParams): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root for Three.js renderer.");
  const conn = new Connection(resolveWsUrl(window.location), loadStoredName(), persistentClientId());
  bindVersionRefreshOverlay(conn);
  const title = new StandaloneTitle(conn, root, () => startThreeDungeon({ root, search, conn }));
  title.start();
}
