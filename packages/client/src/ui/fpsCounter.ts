/** Lightweight top-right FPS & RTT ping pills for desktop/mobile performance profiling. */
import type { ConnectionMode } from "../net/worldClientHelpers.js";

function tierForFps(fps: number): "good" | "warn" | "low" {
  if (fps >= 55) return "good";
  return fps >= 35 ? "warn" : "low";
}

function tierForPing(ms: number): "good" | "warn" | "low" {
  if (ms <= 60) return "good";
  return ms <= 130 ? "warn" : "low";
}

export class FpsCounter {
  readonly el: HTMLDivElement;
  private windowStartMs = 0;
  private prevMs = 0;
  private frames = 0;
  private maxFrameMs = 0;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ow-pill ow-fps-pill";
    this.el.textContent = "-- FPS";
    this.el.title = "Measuring frame rate...";
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }

  tick(nowMs: number): void {
    if (this.windowStartMs === 0) {
      this.windowStartMs = nowMs;
      this.prevMs = nowMs;
      return;
    }
    this.frames++;
    this.maxFrameMs = Math.max(this.maxFrameMs, nowMs - this.prevMs);
    this.prevMs = nowMs;
    const elapsed = nowMs - this.windowStartMs;
    if (elapsed < 500) return;
    const fps = Math.round((this.frames * 1000) / elapsed);
    const avgMs = elapsed / this.frames;
    this.el.textContent = `${fps} FPS`;
    this.el.dataset.tier = tierForFps(fps);
    this.el.title = `${fps} FPS · avg ${avgMs.toFixed(1)} ms · max ${this.maxFrameMs.toFixed(1)} ms`;
    this.windowStartMs = nowMs;
    this.frames = 0;
    this.maxFrameMs = 0;
  }
}

export class PingCounter {
  readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ow-pill ow-fps-pill ow-ping-pill";
    this.el.textContent = "-- ms";
    this.el.title = "Measuring latency...";
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }

  sync(mode: ConnectionMode, pingMs: number | null | undefined): void {
    if (mode === "reconnecting") {
      this.el.textContent = "Reconnecting...";
      this.el.dataset.tier = "low";
      this.el.title = "Connection lost — reconnecting to server";
      return;
    }
    if (mode === "connecting") {
      this.el.textContent = "Connecting...";
      this.el.dataset.tier = "warn";
      this.el.title = "Connecting to server";
      return;
    }
    if (mode !== "server") {
      this.el.textContent = "Offline";
      this.el.dataset.tier = "warn";
      this.el.title = "Not connected to server";
      return;
    }
    if (pingMs === null || pingMs === undefined) {
      this.el.textContent = "-- ms";
      delete this.el.dataset.tier;
      this.el.title = "Measuring latency...";
      return;
    }
    const ms = Math.round(pingMs);
    this.el.textContent = `${ms} ms`;
    this.el.dataset.tier = tierForPing(ms);
    this.el.title = `Round-trip latency: ${ms} ms`;
  }
}
