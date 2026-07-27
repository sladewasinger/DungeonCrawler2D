/** Renderer-neutral HTML opening screen shared by the Phaser and Three.js routes. */
import type { LevelId } from "@dc2d/engine";
import { ASSET_PATHS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import type { Connection } from "../../net/connection.js";
import { ConnectForm } from "./connectForm.js";
import { TitleControlsHint } from "./controlsHint.js";
import { FullscreenChip } from "./fullscreenChip.js";
import "./title.css";

const RETRY_HINT_DELAY_MS = 4000;
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 577;
const ABSOLUTE_POSITION = "position:absolute";

interface AtlasPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
}

const DOOR_PIECES: readonly AtlasPiece[] = [
  { x: 32, y: 240, width: 32, height: 32, left: 48, top: 48 },
  { x: 16, y: 240, width: 16, height: 32, left: 0, top: 48 },
  { x: 64, y: 240, width: 16, height: 32, left: 144, top: 48 },
  { x: 32, y: 224, width: 32, height: 16, left: 48, top: 0 },
];
export interface StandaloneTitleOptions {
  initialStatus?: string;
  beforeConnect?: () => void;
  beforeReady?: () => void;
  onNameInputFocusChange?: (focused: boolean) => void;
}

export interface StandaloneTitleConfig extends StandaloneTitleOptions {
  readonly onReady: () => void;
}

const atlasPiece = (piece: AtlasPiece): HTMLSpanElement => {
  const element = document.createElement("span");
  const scale = WORLD_PIXEL_SCALE;
  element.style.cssText = [
    ABSOLUTE_POSITION,
    `left:${piece.left}px`,
    `top:${piece.top}px`,
    `width:${piece.width * scale}px`,
    `height:${piece.height * scale}px`,
    `background-image:url("${ASSET_PATHS.atlasImage}")`,
    `background-size:${ATLAS_WIDTH * scale}px ${ATLAS_HEIGHT * scale}px`,
    `background-position:${-piece.x * scale}px ${-piece.y * scale}px`,
    "image-rendering:pixelated",
  ].join(";");
  return element;
};

const createDoor = (): HTMLDivElement => {
  const door = document.createElement("div");
  door.className = "title-door";
  door.setAttribute("aria-hidden", "true");
  door.style.cssText = [
    ABSOLUTE_POSITION,
    "left:50%",
    "top:45%",
    "translate:-50% -50%",
    "width:192px",
    "height:144px",
    "filter:drop-shadow(0 0 24px rgba(255,158,61,.48))",
  ].join(";");
  door.append(...DOOR_PIECES.map(atlasPiece));
  return door;
};

const createSparks = (): HTMLDivElement => {
  const sparks = document.createElement("div");
  sparks.className = "title-sparks";
  sparks.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 36; index += 1) {
    const spark = document.createElement("i");
    spark.style.setProperty("--spark-x", `${(index * 37) % 101}%`);
    spark.style.setProperty("--spark-delay", `${-(index % 12) * 0.43}s`);
    spark.style.setProperty("--spark-duration", `${4.8 + (index % 7) * 0.48}s`);
    spark.style.setProperty("--spark-drift", `${-24 + (index * 19) % 49}px`);
    spark.style.setProperty("--spark-size", `${1 + (index % 3)}px`);
    sparks.append(spark);
  }
  return sparks;
};

export class StandaloneTitle {
  private readonly backdrop = document.createElement("div");
  private readonly form: ConnectForm;
  private readonly controls = new TitleControlsHint();
  private readonly fullscreen = new FullscreenChip();
  private retryTimer: number | undefined;

  constructor(
    private readonly connection: Connection,
    private readonly root: HTMLElement,
    private readonly config: StandaloneTitleConfig,
  ) {
    configureBackdrop(this.backdrop);
    this.root.append(this.backdrop);
    this.form = this.createForm();
    if (config.initialStatus) this.form.setStatus(config.initialStatus);
  }

  private createForm(): ConnectForm {
    const { onNameInputFocusChange } = this.config;
    return new ConnectForm({
      onConnect: (name, level, skin) => this.connect(name, level, skin),
      ...(onNameInputFocusChange ? { onNameInputFocusChange } : {}),
    });
  }

  start(): void {
    this.connection.onConnected = () => {
      this.connection.onConnected = null;
      this.config.beforeReady?.();
      this.dispose();
      this.config.onReady();
    };
  }

  private connect(
    name: string,
    level: LevelId,
    skin: import("@dc2d/engine").PlayerSkin,
  ): void {
    this.config.beforeConnect?.();
    this.form.setBusy(true);
    this.form.setStatus("Connecting...");
    this.connection.setName(name);
    this.connection.setSkin(skin);
    this.connection.connect(level);
    this.retryTimer = window.setTimeout(() => {
      if (this.connection.status === "connected") return;
      this.form.setBusy(false);
      this.form.setStatus("Still trying to reach the dungeon...");
    }, RETRY_HINT_DELAY_MS);
  }

  dispose(): void {
    if (this.retryTimer !== undefined) window.clearTimeout(this.retryTimer);
    this.form.dispose(); this.controls.dispose(); this.fullscreen.dispose(); this.backdrop.remove();
  }
}

function configureBackdrop(backdrop: HTMLDivElement): void {
  backdrop.style.cssText = ["position:fixed", "inset:0", "z-index:10", "overflow:hidden", "pointer-events:none", "background:radial-gradient(circle at 50% 58%,#292338 0,#10101a 48%,#07080d 100%)", "color:#ffd23d", "font-family:monogram,monospace"].join(";");
  const title = document.createElement("h1");
  title.className = "title-heading";
  title.textContent = "DUNGEON CRAWLER";
  title.style.cssText = [ABSOLUTE_POSITION, "left:50%", "top:13%", "translate:-50% -50%", "margin:0", "font-size:clamp(34px,7vw,74px)", "letter-spacing:.08em", "white-space:nowrap"].join(";");
  backdrop.append(createSparks(), title, createDoor());
}
