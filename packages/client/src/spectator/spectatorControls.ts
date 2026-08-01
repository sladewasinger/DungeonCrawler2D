import type { SpectatorMode } from "@dc2d/engine";
import type { Connection } from "../net/connection/connection.js";
import { configureToggleSwitch } from "../ui/foundation/toggleSwitch.js";
import {
  applyEmbeddedSpectatorControl,
  type EmbeddedSpectatorControlHandlers,
} from "./controls/embeddedSpectatorControl.js";
import {
  spectatorControlMessage,
  type SpectatorControlMessage,
} from "./spectatorControlMessage.js";
import { SpectatorAvailabilityView } from "./controls/spectatorAvailability.js";

export interface SpectatorControlHandlers extends EmbeddedSpectatorControlHandlers {
  readonly setHudVisible: (visible: boolean) => void;
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
  private readonly availability = new SpectatorAvailabilityView(document.body);
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
    this.availability.dispose();
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
    if (message.action === "hud") {
      this.setHud(message.visible);
      return;
    }
    applyEmbeddedSpectatorControl({
      connection: this.connection,
      handlers: this.handlers,
      message,
    });
  }

  private render(): void {
    this.availability.render(this.connection);
    const currentIds = [...this.player.options].map(({ value }) => value).join("|");
    const nextIds = this.connection.spectatorPlayers.map(({ playerId }) => playerId).join("|");
    if (currentIds !== nextIds) this.replacePlayers();
    this.player.value = this.connection.spectatorTargetId ?? "";
    const free = this.connection.spectatorMode === "free";
    configureToggleSwitch(this.mode, "Free camera", free);
    configureToggleSwitch(this.hud, "HUD", this.hudVisible);
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

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}
