/** Pure canvas drawing helpers for the DAW timeline ruler, bars, ADSR curves, and cue/playhead markers. */
import { activeProceduralTracks } from "../../audio/proceduralSynth.js";
import type { SoundTrackSpec } from "../studioTypes.js";
import { adaptiveTickStepMs, computeEnvelopePoints } from "./timelineMath.js";

export const TIMELINE_RULER_H = 26;
export const TIMELINE_ROW_H = 38;
export const TIMELINE_TOP_PAD = 4;
export const TIMELINE_PAD_X = 14;

export const TRACK_COLORS: Readonly<Record<SoundTrackSpec["kind"], string>> = {
  tone: "#38bdf8",
  sweptNoise: "#fbbf24",
  noise: "#4ade80",
};

export function timelineSecToX(sec: number, width: number, spanSec: number): number {
  return TIMELINE_PAD_X + (sec / Math.max(0.02, spanSec)) * (width - TIMELINE_PAD_X * 2);
}

export function drawTimelineRuler(ctx: CanvasRenderingContext2D, opts: {
  readonly width: number; readonly height: number; readonly spanSec: number;
}): void {
  ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
  ctx.fillRect(0, 0, opts.width, TIMELINE_RULER_H);
  const stepMs = adaptiveTickStepMs(opts.spanSec);
  const totalMs = opts.spanSec * 1000;
  ctx.font = "11px system-ui, sans-serif";
  for (let ms = 0; ms <= totalMs + 0.5; ms += stepMs) {
    const x = timelineSecToX(ms / 1000, opts.width, opts.spanSec);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.beginPath();
    ctx.moveTo(x, TIMELINE_RULER_H);
    ctx.lineTo(x, opts.height);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${Math.round(ms)}ms`, Math.min(opts.width - 44, x + 3), 16);
  }
  const endMs = Math.round(totalMs);
  if (endMs % stepMs > Math.min(12, stepMs * 0.25)) {
    const label = `${endMs}ms`;
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(label, opts.width - Math.max(38, ctx.measureText(label).width + 6), 16);
  }
}

function drawEnvelopeFill(ctx: CanvasRenderingContext2D, opts: {
  readonly track: SoundTrackSpec; readonly x: number; readonly y: number; readonly bw: number; readonly bh: number;
}): void {
  const pts = computeEnvelopePoints(opts.track);
  ctx.fillStyle = "rgba(15, 23, 42, 0.34)";
  ctx.beginPath();
  ctx.moveTo(opts.x, opts.y + opts.bh);
  for (const pt of pts) {
    ctx.lineTo(opts.x + pt.t * opts.bw, opts.y + opts.bh - pt.amp * (opts.bh - 3));
  }
  ctx.lineTo(opts.x + opts.bw, opts.y + opts.bh);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  pts.forEach((pt, idx) => {
    const px = opts.x + pt.t * opts.bw;
    const py = opts.y + opts.bh - pt.amp * (opts.bh - 3);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function drawSingleTrackBar(ctx: CanvasRenderingContext2D, opts: {
  readonly track: SoundTrackSpec; readonly rowIdx: number; readonly width: number;
  readonly spanSec: number; readonly audible: boolean; readonly selected: boolean;
}): void {
  const { track: t, rowIdx, width, spanSec, audible, selected } = opts;
  const rowY = TIMELINE_RULER_H + TIMELINE_TOP_PAD + rowIdx * TIMELINE_ROW_H;
  if (selected) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    ctx.fillRect(0, rowY, width, TIMELINE_ROW_H);
  }
  const x0 = timelineSecToX(t.delaySec, width, spanSec);
  const bw = Math.max(16, timelineSecToX(t.delaySec + t.durationSec, width, spanSec) - x0);
  const gainFrac = 0.48 + Math.min(1, Math.max(0, t.gain / 0.85)) * 0.52;
  const maxBh = TIMELINE_ROW_H - 8;
  const bh = Math.round(maxBh * gainFrac);
  const by = rowY + 4 + (maxBh - bh);

  ctx.save();
  ctx.globalAlpha = audible ? 0.92 : 0.25;
  ctx.fillStyle = TRACK_COLORS[t.kind];
  ctx.fillRect(x0, by, bw, bh);
  if (audible) drawEnvelopeFill(ctx, { track: t, x: x0, y: by, bw, bh });
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(x0, by, 4, bh);
  ctx.fillRect(x0 + bw - 5, by, 5, bh);
  ctx.restore();

  if (selected) {
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 0.5, by + 0.5, bw - 1, bh - 1);
  }
  drawBarLabel(ctx, { track: t, x0, bw, rowY, audible });
}

function drawBarLabel(ctx: CanvasRenderingContext2D, opts: {
  readonly track: SoundTrackSpec; readonly x0: number; readonly bw: number; readonly rowY: number; readonly audible: boolean;
}): void {
  const text = `${opts.track.name} · ${Math.round(opts.track.f0)}→${Math.round(opts.track.f1)}Hz (${Math.round(opts.track.durationSec * 1000)}ms)`;
  ctx.font = "bold 11px system-ui, sans-serif";
  const textW = ctx.measureText(text).width;
  const inside = opts.bw >= textW + 18;
  ctx.fillStyle = inside && opts.audible ? "#090f17" : "#e2e8f0";
  const fitsRight = opts.x0 + opts.bw + 6 + textW <= ctx.canvas.width - 6;
  const tx = inside
    ? opts.x0 + 8
    : fitsRight ? opts.x0 + opts.bw + 6 : Math.max(TIMELINE_PAD_X, opts.x0 - textW - 6);
  ctx.fillText(text, tx, opts.rowY + 23);
}

export function drawTimelineRows(ctx: CanvasRenderingContext2D, opts: {
  readonly tracks: readonly SoundTrackSpec[]; readonly selectedId: string;
  readonly width: number; readonly spanSec: number;
}): void {
  const audibleIds = new Set(activeProceduralTracks(opts.tracks).map((t) => t.id));
  opts.tracks.forEach((track, rowIdx) => {
    drawSingleTrackBar(ctx, {
      track, rowIdx, width: opts.width, spanSec: opts.spanSec,
      audible: audibleIds.has(track.id), selected: track.id === opts.selectedId,
    });
  });
}

export function drawTimelineMarkers(ctx: CanvasRenderingContext2D, opts: {
  readonly cueSec: number; readonly playheadSec: number; readonly width: number;
  readonly height: number; readonly spanSec: number;
}): void {
  const cx = timelineSecToX(opts.cueSec, opts.width, opts.spanSec);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, TIMELINE_RULER_H);
  ctx.lineTo(cx, opts.height);
  ctx.stroke();

  const px = timelineSecToX(opts.playheadSec, opts.width, opts.spanSec);
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(px - 6, 4);
  ctx.lineTo(px + 6, 4);
  ctx.lineTo(px, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(px - 1, 16, 2, opts.height - 16);
}
