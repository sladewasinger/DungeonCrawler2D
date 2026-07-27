/** Phaser title route backed by the same HTML title used by the Three.js route. */
import Phaser from "phaser";
import { isTouchDevice } from "../../input/touchDetect.js";
import type { Connection } from "../../net/connection.js";
import { requestFullscreenBestEffort } from "./fullscreenChip.js";
import { StandaloneTitle } from "./standaloneTitle.js";

const RECAP_SEEN_KEY = "dc2d-seen-recap";
const RECAP_TOAST_MS = 6000;
const RECAP_TEXT =
  "First time down here: WASD to move, click to attack, E to interact, I for your bag. Good luck.";

export interface TitleSceneData {
  expired?: boolean;
}

export class TitleScene extends Phaser.Scene {
  private title: StandaloneTitle | undefined;
  private expired = false;

  constructor(private readonly conn: Connection) {
    super("title");
  }

  init(data?: TitleSceneData): void {
    this.expired = !!data?.expired;
  }

  create(): void {
    const root = document.getElementById("app");
    if (!root) throw new Error("Missing #app root for title screen.");
    this.title = new StandaloneTitle(
      this.conn,
      root,
      {
        onReady: () => this.scene.start("dungeon"),
        onNameInputFocusChange: (focused) => {
          const keyboard = this.input.keyboard;
          if (focused) keyboard?.disableGlobalCapture();
          else keyboard?.enableGlobalCapture();
        },
        ...(this.expired
          ? { initialStatus: "Session expired — reconnect below" }
          : {}),
        beforeConnect: () => {
          if (isTouchDevice()) requestFullscreenBestEffort();
        },
        beforeReady: () => this.queueRecapToastIfFirstEver(),
      },
    );
    this.title.start();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
  }

  private queueRecapToastIfFirstEver(): void {
    if (localStorage.getItem(RECAP_SEEN_KEY)) return;
    localStorage.setItem(RECAP_SEEN_KEY, "1");
    this.conn.pushToast(RECAP_TEXT, RECAP_TOAST_MS);
  }

  private dispose(): void {
    this.title?.dispose();
    this.title = undefined;
  }
}
