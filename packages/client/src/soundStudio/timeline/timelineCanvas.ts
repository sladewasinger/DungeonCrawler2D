/** Interactive DAW timeline canvas: exact fit, live edge expansion, left-push, left/right trim, and playhead scrub. */
import { exactTracksDurationSec } from "../../audio/proceduralSynth.js";
import type { SoundTrackSpec } from "../studioTypes.js";
import {
  TIMELINE_PAD_X, TIMELINE_ROW_H, TIMELINE_RULER_H, TIMELINE_TOP_PAD,
  drawTimelineMarkers, drawTimelineRows, drawTimelineRuler, timelineSecToX,
} from "./timelineDraw.js";
import { applyLeftTrim, applyRightResize, applyTrackMove, snapSec } from "./timelineMath.js";

export interface TimelineCanvasCallbacks {
  readonly onSelectTrack: (id: string) => void;
  readonly onSeek: (sec: number, scrubbing: boolean) => void;
  readonly onReplaceTracks: (next: SoundTrackSpec[]) => void;
  readonly onTrackTiming: (id: string, patch: { readonly delaySec?: number; readonly durationSec?: number }) => void;
  readonly onDragEnd: () => void;
}

type DragState =
  | { readonly kind: "playhead"; readonly spanSec: number }
  | {
    readonly kind: "move"; readonly trackId: string; readonly startSec: number;
    readonly initDelay: number; readonly initTracks: readonly SoundTrackSpec[];
    spanSec: number; pointerX: number; leftPushSec: number; lastStepMs: number;
  }
  | { readonly kind: "resizeLeft"; readonly trackId: string; readonly initTrack: SoundTrackSpec; readonly spanSec: number }
  | {
    readonly kind: "resizeRight"; readonly trackId: string; readonly initTrack: SoundTrackSpec;
    spanSec: number; pointerX: number; lastStepMs: number;
  };

const BG = "#090f17";

export class TimelineCanvas {
  private drag: DragState | null = null;
  private tracks: readonly SoundTrackSpec[] = [];
  private playheadSec = 0;
  private snapMs = 5;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cb: TimelineCanvasCallbacks) {
    this.canvas.width = 960;
    this.bindPointer();
  }

  setSnapMs(ms: number): void {
    this.snapMs = ms;
  }

  private spanSec(): number {
    return this.drag ? this.drag.spanSec : exactTracksDurationSec(this.tracks);
  }

  private canvasCoords(e: PointerEvent): { readonly x: number; readonly y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / Math.max(1, rect.width);
    const scaleY = this.canvas.height / Math.max(1, rect.height);
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  private xToSecUnclamped(x: number, spanSec: number): number {
    const usable = Math.max(1, this.canvas.width - TIMELINE_PAD_X * 2);
    return ((x - TIMELINE_PAD_X) / usable) * spanSec;
  }

  private xToSec(x: number, spanSec: number): number {
    return Math.max(0, Math.min(spanSec, this.xToSecUnclamped(x, spanSec)));
  }

  private hitTest(x: number, y: number): { readonly mode: DragState; readonly cursor: string; readonly rowId?: string } | null {
    const spanSec = this.spanSec();
    const playX = timelineSecToX(this.playheadSec, this.canvas.width, spanSec);
    if (y <= TIMELINE_RULER_H || Math.abs(x - playX) <= 8) {
      return { mode: { kind: "playhead", spanSec }, cursor: "ew-resize" };
    }
    const rowIdx = Math.floor((y - TIMELINE_RULER_H - TIMELINE_TOP_PAD) / TIMELINE_ROW_H);
    const track = this.tracks[rowIdx];
    if (!track) return null;
    const x0 = timelineSecToX(track.delaySec, this.canvas.width, spanSec);
    const x1 = Math.max(x0 + 16, timelineSecToX(track.delaySec + track.durationSec, this.canvas.width, spanSec));
    if (x < x0 - 4 || x > x1 + 6) return { mode: { kind: "playhead", spanSec }, cursor: "default", rowId: track.id };
    if (x <= x0 + 7) return { mode: { kind: "resizeLeft", trackId: track.id, initTrack: { ...track }, spanSec }, cursor: "ew-resize", rowId: track.id };
    if (x >= x1 - 7) return { mode: { kind: "resizeRight", trackId: track.id, initTrack: { ...track }, spanSec, pointerX: x, lastStepMs: performance.now() }, cursor: "ew-resize", rowId: track.id };
    const startSec = this.xToSecUnclamped(x, spanSec);
    return {
      mode: {
        kind: "move", trackId: track.id, startSec, initDelay: track.delaySec,
        initTracks: this.tracks.map((t) => ({ ...t })), spanSec, pointerX: x, leftPushSec: 0, lastStepMs: performance.now(),
      },
      cursor: "grab", rowId: track.id,
    };
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
    if (hit.rowId) this.cb.onSelectTrack(hit.rowId);
    if (hit.cursor === "default") return;
    this.drag = hit.mode;
    this.canvas.setPointerCapture(e.pointerId);
    if (hit.mode.kind === "playhead") {
      this.cb.onSeek(Math.max(0, snapSec(this.xToSec(x, hit.mode.spanSec), this.snapMs)), true);
    }
  }

  private emitMove(drag: Extract<DragState, { kind: "move" }>): void {
    const curSec = this.xToSecUnclamped(drag.pointerX, drag.spanSec);
    const targetDelay = drag.initDelay + (curSec - drag.startSec) - drag.leftPushSec;
    const next = applyTrackMove({ tracks: drag.initTracks, id: drag.trackId, targetDelaySec: targetDelay, snapMs: this.snapMs });
    drag.spanSec = Math.max(drag.spanSec, exactTracksDurationSec(next));
    this.cb.onReplaceTracks(next);
  }

  private onMove(e: PointerEvent): void {
    const { x, y } = this.canvasCoords(e);
    if (!this.drag) {
      this.canvas.style.cursor = this.hitTest(x, y)?.cursor ?? "default";
      return;
    }
    if (this.drag.kind === "playhead") {
      this.cb.onSeek(Math.max(0, snapSec(this.xToSec(x, this.drag.spanSec), this.snapMs)), true);
      return;
    }
    if (this.drag.kind === "resizeLeft") {
      const targetStartSec = this.xToSec(x, this.drag.spanSec);
      this.cb.onTrackTiming(this.drag.trackId, applyLeftTrim({ track: this.drag.initTrack, targetStartSec, snapMs: this.snapMs }));
      return;
    }
    this.drag.pointerX = x;
    if (this.drag.kind === "move") { this.emitMove(this.drag); return; }
    const targetEndSec = Math.max(0, this.xToSecUnclamped(x, this.drag.spanSec));
    this.cb.onTrackTiming(this.drag.trackId, applyRightResize({ track: this.drag.initTrack, targetEndSec, snapMs: this.snapMs }));
  }

  private stepRightWall(drag: Extract<DragState, { kind: "move" | "resizeRight" }>, dt: number): boolean {
    const rightEdge = this.canvas.width - TIMELINE_PAD_X - 4;
    if (drag.pointerX <= rightEdge) return false;
    const over = Math.min(1, (drag.pointerX - rightEdge) / 40);
    drag.spanSec = Math.min(3.5, drag.spanSec + over * 0.75 * dt);
    if (drag.kind === "move") {
      this.emitMove(drag);
      return true;
    }
    const targetEndSec = this.xToSec(drag.pointerX, drag.spanSec);
    this.cb.onTrackTiming(drag.trackId, applyRightResize({ track: drag.initTrack, targetEndSec, snapMs: this.snapMs }));
    return true;
  }

  private stepEdgeExpand(nowMs: number): void {
    const drag = this.drag;
    if (!drag || drag.kind === "playhead" || drag.kind === "resizeLeft") return;
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - drag.lastStepMs) / 1000));
    drag.lastStepMs = nowMs;
    if (this.stepRightWall(drag, dt)) return;
    if (drag.kind === "move" && drag.pointerX < TIMELINE_PAD_X + 4) {
      const over = Math.min(1, (TIMELINE_PAD_X + 4 - drag.pointerX) / 40);
      drag.leftPushSec = Math.min(2.5, drag.leftPushSec + (0.14 + over * 0.55) * dt);
      this.emitMove(drag);
    }
  }

  private endDrag(): void {
    if (!this.drag) return;
    this.drag = null;
    this.canvas.style.cursor = "default";
    this.cb.onDragEnd();
  }

  draw(opts: {
    readonly tracks: readonly SoundTrackSpec[]; readonly selectedId: string;
    readonly cueSec: number; readonly playheadSec: number;
  }): void {
    this.tracks = opts.tracks;
    this.playheadSec = opts.playheadSec;
    this.stepEdgeExpand(performance.now());
    const cssW = Math.max(420, Math.round(this.canvas.clientWidth || 960));
    const targetH = TIMELINE_RULER_H + TIMELINE_TOP_PAD * 2 + Math.max(1, opts.tracks.length) * TIMELINE_ROW_H;
    if (this.canvas.width !== cssW) this.canvas.width = cssW;
    if (this.canvas.height !== targetH) { this.canvas.height = targetH; this.canvas.style.height = `${targetH}px`; }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const spanSec = this.spanSec();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, cssW, targetH);
    drawTimelineRuler(ctx, { width: cssW, height: targetH, spanSec });
    drawTimelineRows(ctx, { tracks: opts.tracks, selectedId: opts.selectedId, width: cssW, spanSec });
    drawTimelineMarkers(ctx, { cueSec: opts.cueSec, playheadSec: opts.playheadSec, width: cssW, height: targetH, spanSec });
  }
}
