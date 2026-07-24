/** Renderer-neutral opening screen for clients that do not boot a Phaser title scene. */
import type { LevelId } from "@dc2d/engine";
import type { Connection } from "../../net/connection.js";
import { ConnectForm } from "./connectForm.js";

export class StandaloneTitle {
  private readonly backdrop = document.createElement("div");
  private readonly form: ConnectForm;

  constructor(
    private readonly connection: Connection,
    private readonly root: HTMLElement,
    private readonly onReady: () => void,
  ) {
    this.backdrop.style.cssText = [
      "position:absolute",
      "inset:0",
      "display:grid",
      "place-items:center",
      "background:radial-gradient(circle at 50% 58%,#292338 0,#10101a 48%,#07080d 100%)",
      "color:#ffd23d",
      "font-family:monogram,monospace",
    ].join(";");
    const title = document.createElement("h1");
    title.textContent = "DUNGEON CRAWLER";
    title.style.cssText = "margin:0 0 25vh;font-size:clamp(34px,7vw,74px);letter-spacing:.08em";
    this.backdrop.append(title);
    this.root.replaceChildren(this.backdrop);
    this.form = new ConnectForm({
      onConnect: (name, level) => this.connect(name, level),
    });
  }

  start(): void {
    this.connection.onConnected = () => {
      this.connection.onConnected = null;
      this.dispose();
      this.onReady();
    };
  }

  private connect(name: string, level: LevelId): void {
    this.form.setBusy(true);
    this.form.setStatus("Connecting...");
    this.connection.setName(name);
    this.connection.connect(level);
  }

  private dispose(): void {
    this.form.dispose();
    this.backdrop.remove();
  }
}
