import type { SpectatorMode } from "@dc2d/engine";
import { spectatorUrl } from "../../spectator/spectatorUrl.js";

export interface FullSpectatorEmbedState {
  readonly active: boolean;
  readonly playerId: string | null;
  readonly mode: Exclude<SpectatorMode, "off"> | "off";
}

export class FullSpectatorEmbed {
  readonly element = document.createElement("div");
  private frame: HTMLIFrameElement | null = null;
  private sent: SentSpectatorEmbedState | null = null;
  private loaded = false;
  private state: FullSpectatorEmbedState = {
    active: false,
    playerId: null,
    mode: "off",
  };

  constructor() {
    this.element.dataset.adminSpectatorFrame = "";
  }

  update(state: FullSpectatorEmbedState): void {
    this.state = state;
    if (!state.active) return this.unmount();
    if (!this.frame) return this.mount();
    this.sendState();
  }

  centerOnPlayer(): void {
    if (!this.state.active) return;
    this.send({ type: "dc2d-spectator-control", action: "center" });
  }

  private sendState(): void {
    if (!this.loaded) return;
    const plan = spectatorEmbedMessagePlan(this.sent, this.state);
    for (const message of plan.messages) this.send(message);
    this.sent = plan.sent;
  }

  private send(message: Record<string, unknown>): void {
    this.frame?.contentWindow?.postMessage(message, window.location.origin);
  }

  private mount(): void {
    const frame = document.createElement("iframe");
    frame.title = "Live in-game spectator view";
    frame.src = spectatorEmbedSource(window.location.search, this.state) ?? "about:blank";
    frame.addEventListener("load", () => this.handleLoad(frame));
    this.frame = frame;
    this.loaded = false;
    this.sent = sentState(this.state);
    this.element.replaceChildren(frame);
  }

  private unmount(): void {
    const frame = this.frame;
    this.frame = null;
    this.loaded = false;
    this.sent = null;
    if (!frame) return;
    frame.src = "about:blank";
    frame.remove();
  }

  private handleLoad(frame: HTMLIFrameElement): void {
    if (frame !== this.frame) return;
    this.loaded = true;
    this.sendState();
  }
}

interface SentSpectatorEmbedState {
  readonly playerId: string | null;
  readonly mode: Exclude<SpectatorMode, "off"> | null;
}

interface SpectatorEmbedMessagePlan {
  readonly messages: Array<Record<string, unknown>>;
  readonly sent: SentSpectatorEmbedState | null;
}

export function spectatorEmbedMessagePlan(
  previous: SentSpectatorEmbedState | null,
  state: FullSpectatorEmbedState,
): SpectatorEmbedMessagePlan {
  if (!state.active) return { messages: [], sent: previous };
  const targetChanged = previous?.playerId !== state.playerId;
  const modeAfterTarget = targetChanged && state.playerId ? "track" : previous?.mode ?? null;
  return {
    messages: [
      ...targetChangeMessage(targetChanged, state.playerId),
      ...modeChangeMessage(state.mode, modeAfterTarget),
    ],
    sent: { playerId: state.playerId, mode: state.mode === "off" ? null : state.mode },
  };
}

export function spectatorEmbedSource(
  search: string,
  state: FullSpectatorEmbedState,
): string | null {
  if (!state.active || state.mode === "off") return null;
  return spectatorUrl(search, {
    embedded: true,
    hud: false,
    mode: state.mode,
    ...(state.playerId ? { playerId: state.playerId } : {}),
  });
}

function sentState(state: FullSpectatorEmbedState): SentSpectatorEmbedState | null {
  if (!state.active || state.mode === "off") return null;
  return { playerId: state.playerId, mode: state.mode };
}

function targetChangeMessage(
  changed: boolean,
  playerId: string | null,
): Array<Record<string, unknown>> {
  return changed && playerId
    ? [controlMessage("target", { playerId })]
    : [];
}

function modeChangeMessage(
  mode: FullSpectatorEmbedState["mode"],
  previous: SentSpectatorEmbedState["mode"],
): Array<Record<string, unknown>> {
  return mode !== "off" && mode !== previous
    ? [controlMessage("mode", { mode })]
    : [];
}

function controlMessage(
  action: string,
  details: Record<string, unknown>,
): Record<string, unknown> {
  return { type: "dc2d-spectator-control", action, ...details };
}
