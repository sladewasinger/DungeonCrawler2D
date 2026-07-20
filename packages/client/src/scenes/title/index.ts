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
import { ConnectForm, loadStoredName } from "./connectForm.js";

const GAME_NAME = "DUNGEON CRAWLER";
/** How long a first attempt gets before the status line admits it's still retrying (net/socket.ts backs off every 1s on its own). */
const RETRY_HINT_DELAY_MS = 4000;

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
    this.form = new ConnectForm({ onConnect: (name) => this.handleConnect(name) });
    this.conn.onConnected = () => this.scene.start("dungeon");
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

  private hintIfStillConnecting(): void {
    if (this.conn.status === "connected") return;
    this.form?.setBusy(false);
    this.form?.setStatus("Still trying to reach the dungeon...");
  }

  private setUpResize(): void {
    const onResize = (gameSize: Phaser.Structs.Size) => {
      this.background?.layout(gameSize.width, gameSize.height);
      this.title?.setPosition(gameSize.width / 2, gameSize.height * 0.28);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private dispose(): void {
    this.background?.dispose();
    this.form?.dispose();
  }
}
