import type { SpectatorMode } from "@dc2d/engine";
import { nextSpectatorCameraZoom } from "../../spectator/camera/spectatorCameraZoom.js";
import {
  spectatorEmbedMessagePlan,
  spectatorEmbedSource,
  spectatorEmbedZoomMessage,
  type SentSpectatorEmbedState,
} from "./embed/fullSpectatorEmbedMessages.js";
import { spectatorZoomControls } from "./embed/spectatorZoomControls.js";

const SPECTATOR_CONTROL_MESSAGE_TYPE = "dc2d-spectator-control";

export interface FullSpectatorEmbedState {
  readonly active: boolean;
  readonly playerId: string | null;
  readonly mode: Exclude<SpectatorMode, "off"> | "off";
}

export class FullSpectatorEmbed {
  readonly element = document.createElement("div");
  private readonly controls = spectatorZoomControls({
    zoom: (direction) => this.zoom(direction),
    reset: () => this.resetZoom(),
  });
  private readonly frameHost = document.createElement("div");
  private readonly zoomStatus = document.createElement("span");
  private frame: HTMLIFrameElement | null = null;
  private sent: SentSpectatorEmbedState | null = null;
  private loaded = false;
  private cameraZoom = 1.25;
  private state: FullSpectatorEmbedState = {
    active: false,
    playerId: null,
    mode: "off",
  };

  constructor() {
    this.element.dataset.adminSpectatorFrame = "";
    this.frameHost.dataset.adminSpectatorFrameHost = "";
    this.zoomStatus.dataset.adminSpectatorZoomStatus = "";
    this.zoomStatus.setAttribute("aria-live", "polite");
    this.updateZoomStatus();
    this.element.append(this.controls, this.zoomStatus, this.frameHost);
  }

  update(state: FullSpectatorEmbedState): void {
    this.state = state;
    if (!state.active) return this.unmount();
    if (!this.frame) return this.mount();
    this.sendState();
  }

  centerOnPlayer(): void {
    if (!this.state.active) return;
    this.send({ type: SPECTATOR_CONTROL_MESSAGE_TYPE, action: "center" });
  }

  zoom(direction: "in" | "out"): void {
    if (!this.state.active) return;
    this.send(spectatorEmbedZoomMessage(direction));
    this.cameraZoom = nextSpectatorCameraZoom(this.cameraZoom, direction);
    this.updateZoomStatus();
    focusSpectatorEmbedFrame(this.frame);
  }

  resetZoom(): void {
    if (!this.state.active) return;
    this.send({ type: SPECTATOR_CONTROL_MESSAGE_TYPE, action: "zoom-reset" });
    this.cameraZoom = 1;
    this.updateZoomStatus();
    focusSpectatorEmbedFrame(this.frame);
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
    this.sent = spectatorEmbedMessagePlan(null, this.state).sent;
    this.frameHost.replaceChildren(frame);
  }

  private unmount(): void {
    const frame = this.frame;
    this.frame = null;
    this.loaded = false;
    this.sent = null;
    if (!frame) return;
    frame.src = "about:blank";
    frame.remove();
    this.frameHost.replaceChildren();
  }

  private handleLoad(frame: HTMLIFrameElement): void {
    if (frame !== this.frame) return;
    this.loaded = true;
    this.sendState();
  }

  private updateZoomStatus(): void {
    this.zoomStatus.textContent = `Zoom: ${Math.round(this.cameraZoom * 100)}%`;
  }
}

export function focusSpectatorEmbedFrame(
  frame: { readonly contentWindow: { focus(): void } | null } | null,
): void {
  frame?.contentWindow?.focus();
}
