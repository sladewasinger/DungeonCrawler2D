// TitleScene: the game's front door — its name in the monogram pixel font over a dark
// animated background (drifting embers + a torchlit door), a name field, and a connect
// button. Auto-connects silently when a resume token is already on file (rejoin flow);
// otherwise waits for the player. Hands off to "dungeon" the moment the server welcomes us.
import { LEVEL } from "@dc2d/engine";
import Phaser from "phaser";
import { loadResumeToken } from "../../net/identity.js";
import type { Connection } from "../../net/connection.js";
import { pixelTextStyle } from "../../ui/font.js";
import { TitleBackground } from "./background.js";
import { TitleControlsHint } from "./controlsHint.js";
import { ConnectForm, loadStoredName } from "./connectForm.js";

const GAME_NAME = "DUNGEON CRAWLER";
/** How long a first attempt gets before the status line admits it's still retrying (net/socket.ts backs off every 1s on its own). */
const RETRY_HINT_DELAY_MS = 4000;
/** Once-ever flag (browser-scoped, like the stored name) gating the first-spawn recap
 * toast — judge-panel finding: "the first minute is pure guesswork". Returning players
 * already know the controls, so this fires once per browser, not once per session. */
const RECAP_SEEN_KEY = "dc2d-seen-recap";
const RECAP_TOAST_MS = 6000;
const RECAP_TEXT = "First time down here: WASD to move, click to attack, E to interact, I for your bag. Good luck.";

export interface TitleSceneData {
  /** Epic 7.12: DungeonScene routes here once reconnect retries give up (net/socket.ts's
   * MAX_RECONNECT_ATTEMPTS) — a clean landing with an explanatory status line instead of
   * a dead "Reconnecting..." spinner. */
  expired?: boolean;
}

export class TitleScene extends Phaser.Scene {
  private background: TitleBackground | undefined;
  private form: ConnectForm | undefined;
  private title: Phaser.GameObjects.Text | undefined;
  private controlsHint: TitleControlsHint | undefined;
  private expired = false;

  constructor(private readonly conn: Connection) {
    super("title");
  }

  init(data?: TitleSceneData): void {
    this.expired = !!data?.expired;
  }

  create(): void {
    this.background = new TitleBackground(this);
    this.title = this.add
      .text(this.scale.width / 2, this.scale.height * 0.28, GAME_NAME, pixelTextStyle(48, "#ffd23d"))
      .setOrigin(0.5, 0.5)
      .setDepth(3);
    this.controlsHint = new TitleControlsHint(this);
    this.form = new ConnectForm({ onConnect: (name) => this.handleConnect(name) });
    this.conn.onConnected = () => {
      this.queueRecapToastIfFirstEver();
      this.scene.start("dungeon");
    };
    this.setUpResize();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    if (this.expired) this.form?.setStatus("Session expired — reconnect below");
    else this.autoResumeIfPossible();
  }

  update(time: number): void {
    this.background?.update(time);
  }

  /** Silently rejoins if the browser already holds a live session token (see net/identity.ts). */
  private autoResumeIfPossible(): void {
    if (!loadResumeToken(LEVEL.Dungeon)) return;
    this.form?.setStatus("Rejoining...");
    this.form?.setBusy(true);
    this.conn.setName(loadStoredName());
    this.conn.connect(LEVEL.Dungeon);
  }

  private handleConnect(name: string): void {
    this.form?.setBusy(true);
    this.form?.setStatus("Connecting...");
    this.conn.setName(name);
    this.conn.connect(LEVEL.Dungeon);
    this.time.delayedCall(RETRY_HINT_DELAY_MS, () => this.hintIfStillConnecting());
  }

  /** Queues the compact "how to play" recap toast (BUILD (1)'s "first spawn" recap) —
   * once per browser, via localStorage, not once per connect. Renders through the
   * shared toast stack (ui/widgets/hud/toastStack.ts) once "dungeon" is live. */
  private queueRecapToastIfFirstEver(): void {
    if (localStorage.getItem(RECAP_SEEN_KEY)) return;
    localStorage.setItem(RECAP_SEEN_KEY, "1");
    this.conn.pushToast(RECAP_TEXT, RECAP_TOAST_MS);
  }

  private hintIfStillConnecting(): void {
    if (this.conn.status === "connected") return;
    this.form?.setBusy(false);
    this.form?.setStatus("Still trying to reach the dungeon...");
  }

  private setUpResize(): void {
    const onResize = (gameSize: Phaser.Structs.Size) => {
      this.background?.layout(gameSize.width, gameSize.height);
      this.title?.setPosition(gameSize.width / 2, gameSize.height * 0.28);
      this.controlsHint?.layout(gameSize.width, gameSize.height);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private dispose(): void {
    this.background?.dispose();
    this.form?.dispose();
    this.controlsHint?.dispose();
  }
}
