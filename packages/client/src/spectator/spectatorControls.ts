import type { SpectatorMode } from "@dc2d/engine";
import type { Connection } from "../net/connection/connection.js";

export interface SpectatorControlHandlers {
  readonly setHudVisible: (visible: boolean) => void;
  readonly focusCamera: () => void;
  readonly centerCamera: () => void;
}

export interface SpectatorControlsOptions extends SpectatorControlHandlers {
  readonly connection: Connection;
  readonly hudVisible: boolean;
  readonly embedded: boolean;
}

export class SpectatorControls {
  private readonly root = document.createElement("nav");
  private readonly player = document.createElement("select");
  private readonly mode = button("Free camera");
  private readonly hud = button("HUD");
  private readonly status = document.createElement("span");
  private hudVisible: boolean;
  private readonly connection: Connection;
  private readonly handlers: SpectatorControlHandlers;

  constructor(options: SpectatorControlsOptions) {
    this.connection = options.connection;
    this.handlers = options;
    this.hudVisible = options.hudVisible;
    this.build(options.embedded);
    this.bind();
    this.render();
  }

  dispose(): void {
    window.removeEventListener("message", this.handleMessage);
    this.root.remove();
  }

  private build(embedded: boolean): void {
    this.root.className = `spectator-controls${embedded ? " spectator-controls--embedded" : ""}`;
    this.hud.className = "spectator-controls__hud-toggle";
    if (embedded) {
      this.root.append(this.hud);
      document.body.append(this.root);
      return;
    }
    const back = document.createElement("a");
    back.href = "/";
    back.textContent = "← Title screen";
    const previous = button("Previous");
    const next = button("Next");
    previous.addEventListener("click", () => this.connection.cycleSpectator("previous"));
    next.addEventListener("click", () => this.connection.cycleSpectator("next"));
    this.status.className = "spectator-controls__status";
    this.root.append(back, previous, this.player, next, this.mode, this.hud, this.status);
    document.body.append(this.root);
  }

  private bind(): void {
    this.player.addEventListener("change", () => {
      if (this.player.value) this.connection.selectSpectatorTarget(this.player.value);
    });
    this.mode.addEventListener("click", () => this.toggleMode());
    this.hud.addEventListener("click", () => this.setHud(!this.hudVisible));
    this.connection.onSpectatorState = () => this.render();
    window.addEventListener("message", this.handleMessage);
  }

  private readonly handleMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin) return;
    const message = spectatorControlMessage(event.data);
    if (!message) return;
    this.applyMessage(message);
  };

  private applyMessage(message: SpectatorControlMessage): void {
    if (message.action === "target") return this.applyTargetMessage(message);
    if (message.action === "mode" && message.mode) return this.setMode(message.mode);
    if (message.action === "center") return this.handlers.centerCamera();
    if (message.action === "hud" && typeof message.visible === "boolean") {
      this.setHud(message.visible);
    }
  }

  private applyTargetMessage(message: SpectatorControlMessage): void {
    if (message.playerId) this.connection.selectSpectatorTarget(message.playerId);
  }

  private render(): void {
    const currentIds = [...this.player.options].map(({ value }) => value).join("|");
    const nextIds = this.connection.spectatorPlayers.map(({ playerId }) => playerId).join("|");
    if (currentIds !== nextIds) this.replacePlayers();
    this.player.value = this.connection.spectatorTargetId ?? "";
    const free = this.connection.spectatorMode === "free";
    this.mode.textContent = free ? "Free camera" : "Follow player";
    this.mode.setAttribute("aria-pressed", String(free));
    this.hud.setAttribute("aria-pressed", String(this.hudVisible));
    const target = this.connection.spectatorPlayers
      .find(({ playerId }) => playerId === this.connection.spectatorTargetId);
    this.status.textContent = target
      ? `${target.name} · ${target.level} floor ${target.floor}`
      : "Waiting for a player…";
  }

  private replacePlayers(): void {
    this.player.replaceChildren(...this.connection.spectatorPlayers.map((player) => {
      const option = document.createElement("option");
      option.value = player.playerId;
      option.textContent = player.name;
      return option;
    }));
  }

  private toggleMode(): void {
    this.setMode(this.connection.spectatorMode === "free" ? "track" : "free");
  }

  private setMode(mode: SpectatorMode): void {
    this.connection.setSpectatorMode(mode);
    if (mode === "free") this.handlers.focusCamera();
  }

  private setHud(visible: boolean): void {
    this.hudVisible = visible;
    this.handlers.setHudVisible(visible);
    this.render();
  }
}

interface SpectatorControlMessage {
  readonly type: "dc2d-spectator-control";
  readonly action: "target" | "mode" | "hud" | "center";
  readonly playerId?: string;
  readonly mode?: SpectatorMode;
  readonly visible?: boolean;
}

function spectatorControlMessage(value: unknown): SpectatorControlMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Partial<SpectatorControlMessage>;
  return message.type === "dc2d-spectator-control" ? message as SpectatorControlMessage : null;
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}
