/** Lightweight top-right FPS & frame-time pill for desktop/mobile performance profiling. */

function tierForFps(fps: number): "good" | "warn" | "low" {
  if (fps >= 55) return "good";
  return fps >= 35 ? "warn" : "low";
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
