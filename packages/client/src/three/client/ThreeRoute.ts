/** Boots the Three.js renderer only after the route selects first-person mode. */
import { Connection } from "../../net/connection/connection.js";
import { bindVersionRefreshOverlay } from "../../boot/versionRefreshOverlay.js";
import { persistentClientId } from "../../net/auth/identity.js";
import { resolveWsUrl } from "../../net/connection/url.js";
import { loadStoredName } from "../../scenes/title/connectForm.js";
import { StandaloneTitle } from "../../scenes/title/standaloneTitle.js";
import { startThreeDungeon } from "./ThreeDungeonClient.js";
import { consumeSessionEndMessage } from "../../net/connection/lifecycle/sessionEnd.js";

export function startThreeRoute(search: URLSearchParams): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app root for Three.js renderer.");
  const conn = new Connection(resolveWsUrl(window.location), loadStoredName(), persistentClientId());
  bindVersionRefreshOverlay(conn);
  const showTitle = (initialStatus?: string): void => {
    let stopDungeon: (() => void) | null = null;
    const title = new StandaloneTitle(conn, root, {
      ...(initialStatus ? { initialStatus } : {}),
      onReady: () => {
        stopDungeon = startThreeDungeon({
          root,
          search,
          conn,
          onQuitToTitle: () => {
            const endMessage = consumeSessionEndMessage(conn);
            stopDungeon?.();
            stopDungeon = null;
            showTitle(endMessage ?? undefined);
          },
        });
      },
    });
    title.start();
  };
  showTitle();
}
