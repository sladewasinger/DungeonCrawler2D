/** Full-width interactive Multi-Track Envelope Timeline with ms ruler, draggable bars, and scrubbing playhead. */
import { activeStudioTracks, totalTracksDurationSec } from "./studioSynth.js";
import type { SoundTrackSpec } from "./studioTypes.js";

const BG = "#090f17";
const RULER_H = 26;
const ROW_H = 28;
const PAD_X = 12;
const COLORS: Readonly<Record<SoundTrackSpec["kind"], string>> = {
  tone: "#38bdf8",
  sweptNoise: "#fbbf24",
  noise: "#4ade80",
};

export interface TimelineCallbacks {
  readonly onSeek: (sec: number, scrubbing: boolean) => void;
  readonly onTrackTiming: (id: string, patch: { readonly delaySec?: number; readonly durationSec?: number }) => void;
  readonly onDragEnd: () => void;
}

type DragMode =
  | { readonly kind: "playhead"; readonly spanSec: number }
  | { readonly kind: "move"; readonly trackId: string; readonly startSec: number; readonly initDelay: number; readonly spanSec: number }
  | { readonly kind: "resize"; readonly trackId: string; readonly startSec: number; readonly initDur: number; readonly spanSec: number };

function snap5ms(sec: number): number {
  return Math.round(sec * 200) / 200;
}

function tickStepMsFor(spanSec: number): number {
  if (spanSec <= 0.65) return 50;
  if (spanSec <= 1.4) return 100;
  return 200;
}

export class StudioTimeline {
  private drag: DragMode | null = null;
  private tracks: readonly SoundTrackSpec[] = [];
  private playheadSec = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cb: TimelineCallbacks) {
    this.canvas.width = 1060;
    this.bindPointer();
  }

  private canvasCoords(e: PointerEvent): { readonly x: number; readonly y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / Math.max(1, rect.width);
    const scaleY = this.canvas.height / Math.max(1, rect.height);
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  private spanSec(): number {
    return this.drag ? this.drag.spanSec : Math.max(0.4, totalTracksDurationSec(this.tracks));
  }

  private xToSec(x: number, spanSec: number): number {
    const usable = this.canvas.width - PAD_X * 2;
    return Math.max(0, Math.min(spanSec, ((x - PAD_X) / usable) * spanSec));
  }

  private secToX(sec: number, spanSec: number): number {
    return PAD_X + (sec / spanSec) * (this.canvas.width - PAD_X * 2);
  }

  private hitTest(x: number, y: number): { readonly mode: DragMode; readonly cursor: string } | null {
    const spanSec = this.spanSec();
    const playX = this.secToX(this.playheadSec, spanSec);
    if (y <= RULER_H || Math.abs(x - playX) <= 9) {
      return { mode: { kind: "playhead", spanSec }, cursor: "ew-resize" };
    }
    const rowIdx = Math.floor((y - RULER_H - 6) / ROW_H);
    const track = this.tracks[rowIdx];
    if (!track) return null;
    const x0 = this.secToX(track.delaySec, spanSec);
    const x1 = Math.max(x0 + 14, this.secToX(track.delaySec + track.durationSec, spanSec));
    if (x < x0 - 4 || x > x1 + 6) return null;
    const startSec = this.xToSec(x, spanSec);
    if (x >= x1 - 9) {
      return { mode: { kind: "resize", trackId: track.id, startSec, initDur: track.durationSec, spanSec }, cursor: "ew-resize" };
    }
    return { mode: { kind: "move", trackId: track.id, startSec, initDelay: track.delaySec, spanSec }, cursor: "grab" };
  }

  private bindPointer(): void {
    this.canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
    this.canvas.addEventListener("pointerup", () => this.endDrag());
    this.canvas.addEventListener("pointercancel", () => this.endDrag());
  }

  private onDown(e: PointerEvent): void {
    const { x, y } = this.canvasCoords(e);
    const hit = this.hitTest(x, y);
    if (!hit) return;
    this.drag = hit.mode;
    this.canvas.setPointerCapture(e.pointerId);
    if (hit.mode.kind === "playhead") this.cb.onSeek(snap5ms(this.xToSec(x, hit.mode.spanSec)), true);
  }

  private onMove(e: PointerEvent): void {
    const { x, y } = this.canvasCoords(e);
    if (!this.drag) {
      this.canvas.style.cursor = this.hitTest(x, y)?.cursor ?? "default";
      return;
    }
    const sec = this.xToSec(x, this.drag.spanSec);
    if (this.drag.kind === "playhead") { this.cb.onSeek(snap5ms(sec), true); return; }
    const delta = sec - this.drag.startSec;
    if (this.drag.kind === "move") {
      this.cb.onTrackTiming(this.drag.trackId, { delaySec: Math.max(0, Math.min(0.9, snap5ms(this.drag.initDelay + delta))) });
      return;
    }
    this.cb.onTrackTiming(this.drag.trackId, { durationSec: Math.max(0.02, Math.min(0.9, snap5ms(this.drag.initDur + delta))) });
  }

  private endDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.canvas.style.cursor = "default";
    this.cb.onDragEnd();
  }

  draw(tracks: readonly SoundTrackSpec[], playheadSec: number): void {
    this.tracks = tracks;
    this.playheadSec = playheadSec;
    const targetH = Math.max(176, RULER_H + 10 + tracks.length * ROW_H);
    if (this.canvas.height !== targetH) this.canvas.height = targetH;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const spanSec = this.spanSec();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawRuler(ctx, spanSec);
    this.drawRows(ctx, spanSec);
    this.drawPlayhead(ctx, spanSec);
  }

  private drawRuler(ctx: CanvasRenderingContext2D, spanSec: number): void {
    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(0, 0, this.canvas.width, RULER_H);
    const stepMs = tickStepMsFor(spanSec);
    const totalMs = spanSec * 1000;
    ctx.font = "11px system-ui, sans-serif";
    for (let ms = 0; ms <= totalMs + 1; ms += stepMs) {
      const x = this.secToX(ms / 1000, spanSec);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
      ctx.beginPath();
      ctx.moveTo(x, RULER_H);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${ms}ms`, Math.min(this.canvas.width - 36, x + 3), 16);
    }
  }

  private drawRows(ctx: CanvasRenderingContext2D, spanSec: number): void {
    const audible = new Set(activeStudioTracks(this.tracks).map((t) => t.id));
    this.tracks.forEach((t, idx) => {
      const y = RULER_H + 6 + idx * ROW_H;
      const x0 = this.secToX(t.delaySec, spanSec);
      const bw = Math.max(14, this.secToX(t.delaySec + t.durationSec, spanSec) - x0);
      ctx.globalAlpha = audible.has(t.id) ? 0.92 : 0.25;
      ctx.fillStyle = COLORS[t.kind];
      ctx.fillRect(x0, y + 2, bw, ROW_H - 6);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x0 + bw - 5, y + 2, 5, ROW_H - 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = audible.has(t.id) ? "#0f172a" : "#94a3b8";
      ctx.font = "bold 11px system-ui, sans-serif";
      const textX = bw > 140 ? x0 + 6 : x0 + bw + 6;
      if (bw <= 140) ctx.fillStyle = "#e2e8f0";
      ctx.fillText(`${t.name} · ${Math.round(t.f0)}→${Math.round(t.f1)}Hz (${Math.round(t.delaySec * 1000)}ms)`, textX, y + 17);
    });
  }

  private drawPlayhead(ctx: CanvasRenderingContext2D, spanSec: number): void {
    const px = this.secToX(this.playheadSec, spanSec);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(px - 6, 4);
    ctx.lineTo(px + 6, 4);
    ctx.lineTo(px, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(px - 1, 16, 2, this.canvas.height - 16);
  }
}
