/** Procedural 3x HD-pixel (48 px/tile) roaring stone-ring campfire & pixel-fire torch animations. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, fillEllipsePixel, stampSelOutOutline } from "./pixelCanvas.js";

const FIRE_DEEP = "#b91c1c";
const FIRE_ORANGE = "#ea580c";
const FIRE_BRIGHT = "#f97316";
const FIRE_GOLD = "#facc15";
const FIRE_CORE = "#fef9c3";

const STONE_DARK = "#334155";
const STONE_MID = "#475569";
const STONE_LIGHT = "#64748b";
const STONE_HI = "#94a3b8";

const WOOD_DARK = "#452412";
const WOOD_MID = "#6b3b1f";
const WOOD_LIGHT = "#8c522d";
const WOOD_END = "#cfa26c";
const CHAR_DARK = "#1c1917";

const IRON_DARK = "#1e293b";
const IRON_MID = "#475569";
const IRON_HI = "#94a3b8";

interface FlameTongueSpec {
  readonly bx: number;
  readonly baseY: number;
  readonly h: number;
  readonly baseHw: number;
  readonly lean: number;
  readonly flutter: number;
  readonly phase: number;
  readonly frame: number;
  readonly color: string;
}

function paintFlameTongue(ctx: CanvasRenderingContext2D, s: FlameTongueSpec): void {
  ctx.fillStyle = s.color;
  const span = Math.max(1, s.h - 1);
  for (let dy = 0; dy < s.h; dy++) {
    const t = dy / span;
    const wave = Math.sin(t * 4.4 + s.phase) * s.lean * t + Math.sin(t * 8.6 + s.frame * 1.15 + s.phase) * s.flutter * t;
    const envelope = t < 0.22 ? 0.72 + t * 1.25 : Math.pow(Math.max(0, 1 - (t - 0.22) / 0.78), 1.38);
    const lick = 1 - 0.18 * (Math.sin(dy * 0.72 + s.frame * 2.1 + s.phase) * 0.5 + 0.5);
    const hw = Math.floor(s.baseHw * envelope * lick);
    ctx.fillRect(Math.round(s.bx + wave) - hw, s.baseY - dy, Math.max(1, hw * 2 + 1), 1);
  }
}

interface LogSpec {
  readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number;
  readonly radius: number; readonly capSide: "start" | "end";
}

function paintLogStep(ctx: CanvasRenderingContext2D, opts: {
  readonly cx: number; readonly cy: number; readonly r: number; readonly t: number;
}): void {
  const { cx, cy, r, t } = opts;
  ctx.fillStyle = t > 0.7 ? CHAR_DARK : WOOD_DARK;
  ctx.fillRect(cx - r, cy - r, r * 2 + 1, r * 2);
  ctx.fillStyle = t > 0.8 ? FIRE_DEEP : t > 0.65 ? CHAR_DARK : WOOD_MID;
  ctx.fillRect(cx - r + 1, cy - r, r * 2 - 1, Math.max(1, Math.round(r * 1.35)));
  if (t < 0.65) {
    ctx.fillStyle = WOOD_LIGHT;
    ctx.fillRect(cx - r + 2, cy - r + 1, Math.max(1, r), Math.max(1, Math.floor(r * 0.65)));
  }
}

function paintFirewoodLog(ctx: CanvasRenderingContext2D, log: LogSpec): void {
  const steps = Math.max(8, Math.ceil(Math.hypot(log.x1 - log.x0, log.y1 - log.y0) * 1.4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(log.x0 + (log.x1 - log.x0) * t);
    const cy = Math.round(log.y0 + (log.y1 - log.y0) * t);
    paintLogStep(ctx, { cx, cy, r: log.radius, t });
  }
  const ex = log.capSide === "start" ? log.x0 : log.x1;
  const ey = log.capSide === "start" ? log.y0 : log.y1;
  fillEllipsePixel(ctx, { cx: ex, cy: ey, rx: log.radius * 0.85, ry: log.radius * 0.68, color: WOOD_END });
  fillEllipsePixel(ctx, { cx: ex, cy: ey, rx: 1.5, ry: 1.2, color: WOOD_DARK });
}

interface HearthStoneSpec {
  readonly ang: number; readonly rx: number; readonly ry: number; readonly back: boolean;
}

const HEARTH_STONES: readonly HearthStoneSpec[] = [
  { ang: -2.62, rx: 9, ry: 5.5, back: true },
  { ang: -2.02, rx: 7.5, ry: 5, back: true },
  { ang: -1.48, rx: 9.5, ry: 5.2, back: true },
  { ang: -0.92, rx: 8, ry: 4.8, back: true },
  { ang: -0.36, rx: 8.5, ry: 5.5, back: true },
  { ang: 0.24, rx: 9, ry: 6, back: false },
  { ang: 0.88, rx: 7.5, ry: 5.6, back: false },
  { ang: 1.54, rx: 10, ry: 6.2, back: false },
  { ang: 2.22, rx: 8, ry: 5.8, back: false },
  { ang: 2.86, rx: 9, ry: 6, back: false },
];

function paintStoneRing(ctx: CanvasRenderingContext2D, backOnly: boolean): void {
  for (const st of HEARTH_STONES) {
    if (st.back !== backOnly) continue;
    const sx = 54 + Math.cos(st.ang) * 30;
    const sy = 76 + Math.sin(st.ang) * 14.5;
    fillEllipsePixel(ctx, { cx: sx, cy: sy + 1.5, rx: st.rx, ry: st.ry, color: STONE_DARK });
    fillEllipsePixel(ctx, { cx: sx, cy: sy, rx: st.rx - 1, ry: st.ry - 0.8, color: STONE_MID });
    fillEllipsePixel(ctx, { cx: sx - 1.5, cy: sy - 1.8, rx: st.rx * 0.65, ry: st.ry * 0.52, color: STONE_LIGHT });
    fillEllipsePixel(ctx, { cx: sx - 2.5, cy: sy - 2.2, rx: st.rx * 0.32, ry: st.ry * 0.24, color: STONE_HI });
    const rimX = sx - Math.cos(st.ang) * st.rx * 0.62;
    const rimY = sy - Math.sin(st.ang) * st.ry * 0.55;
    fillEllipsePixel(ctx, { cx: rimX, cy: rimY, rx: st.rx * 0.24, ry: 1.3, color: "#9a643c" });
  }
}

function paintCampfireBed(ctx: CanvasRenderingContext2D, frame: number): void {
  const pulse = (frame % 3) - 1;
  fillEllipsePixel(ctx, { cx: 54, cy: 76, rx: 33, ry: 15, color: CHAR_DARK });
  fillEllipsePixel(ctx, { cx: 54, cy: 74, rx: 22 + pulse, ry: 8.5, color: FIRE_DEEP });
  fillEllipsePixel(ctx, { cx: 54, cy: 73, rx: 14, ry: 5, color: FIRE_ORANGE });
  for (let i = 0; i < 6; i++) {
    const cx = 44 + ((i * 7 + frame * 3) % 20);
    const cy = 71 + ((i * 5 + frame) % 5);
    ctx.fillStyle = i % 2 === 0 ? FIRE_GOLD : FIRE_BRIGHT;
    ctx.fillRect(cx, cy, 2, 2);
  }
}

const CAMPFIRE_LOGS: readonly LogSpec[] = [
  { x0: 33, y0: 79, x1: 53, y1: 70, radius: 4, capSide: "start" },
  { x0: 75, y0: 79, x1: 55, y1: 70, radius: 4, capSide: "start" },
  { x0: 37, y0: 66, x1: 54, y1: 72, radius: 3.5, capSide: "start" },
  { x0: 71, y0: 66, x1: 54, y1: 72, radius: 3.5, capSide: "start" },
];

function paintCampfireTongues(ctx: CanvasRenderingContext2D, frame: number): void {
  const ph = (frame * Math.PI) / 3;
  const sideH = 26 + ((frame % 2) * 4);
  const mainH = 42 + Math.round(Math.sin(ph) * 4);
  paintFlameTongue(ctx, { bx: 45, baseY: 71, h: sideH, baseHw: 7.5, lean: -4.5, flutter: 1.8, phase: ph + 1.1, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 63, baseY: 71, h: sideH - 2, baseHw: 7.5, lean: 4.5, flutter: 1.8, phase: ph + 3.1, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 54, baseY: 72, h: mainH, baseHw: 13, lean: 3.5, flutter: 2.4, phase: ph, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 47, baseY: 70, h: sideH - 5, baseHw: 5, lean: -3, flutter: 1.5, phase: ph + 1.1, frame, color: FIRE_BRIGHT });
  paintFlameTongue(ctx, { bx: 61, baseY: 70, h: sideH - 6, baseHw: 5, lean: 3, flutter: 1.5, phase: ph + 3.1, frame, color: FIRE_BRIGHT });
  paintFlameTongue(ctx, { bx: 54, baseY: 71, h: mainH - 5, baseHw: 10.5, lean: 2.8, flutter: 2.1, phase: ph, frame, color: FIRE_ORANGE });
  paintFlameTongue(ctx, { bx: 54, baseY: 70, h: mainH - 11, baseHw: 8, lean: 2.2, flutter: 1.8, phase: ph + 0.4, frame, color: FIRE_BRIGHT });
  paintFlameTongue(ctx, { bx: 54, baseY: 69, h: mainH - 18, baseHw: 5.5, lean: 1.6, flutter: 1.3, phase: ph + 0.6, frame, color: FIRE_GOLD });
  paintFlameTongue(ctx, { bx: 54, baseY: 69, h: 13, baseHw: 3.2, lean: 0.8, flutter: 0.8, phase: ph + 0.9, frame, color: FIRE_CORE });
}

function paintRisingSparks(ctx: CanvasRenderingContext2D, opts: {
  readonly frame: number; readonly cx: number; readonly baseY: number; readonly spread: number; readonly rise: number;
}): void {
  for (let i = 0; i < 3; i++) {
    const cycle = (opts.frame + i * 2) % 6;
    const sy = Math.round(opts.baseY - (cycle / 5) * opts.rise);
    const sx = Math.round(opts.cx + Math.sin(cycle * 1.4 + i * 2.1) * opts.spread);
    ctx.fillStyle = cycle < 3 ? FIRE_GOLD : FIRE_BRIGHT;
    ctx.fillRect(sx, sy, cycle < 2 ? 2 : 1, cycle < 2 ? 2 : 1);
  }
}

/** 6-frame 108x108 (2x scale) detailed hearth stone & crossed-log campfire with multi-tongue fire. */
export function makeHdCampfireFrames(): readonly Texture[] {
  return [0, 1, 2, 3, 4, 5].map((frame) => {
    const w = 108; const h = 108;
    const { canvas, ctx } = createPixelCanvas(w, h);
    paintCampfireBed(ctx, frame);
    paintStoneRing(ctx, true);
    for (const log of CAMPFIRE_LOGS) paintFirewoodLog(ctx, log);
    paintCampfireTongues(ctx, frame);
    paintStoneRing(ctx, false);
    paintRisingSparks(ctx, { frame, cx: 54, baseY: 34, spread: 9, rise: 20 });
    stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
    return canvasToNearestTexture(canvas);
  });
}

function paintTorchPost(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WOOD_DARK; ctx.fillRect(19, 34, 6, 36);
  ctx.fillStyle = WOOD_MID; ctx.fillRect(19, 34, 4, 35);
  ctx.fillStyle = WOOD_LIGHT; ctx.fillRect(20, 35, 2, 32);
  ctx.fillStyle = IRON_DARK; ctx.fillRect(17, 29, 10, 6);
  ctx.fillRect(15, 25, 14, 5);
  ctx.fillStyle = IRON_MID; ctx.fillRect(16, 26, 12, 3);
  ctx.fillStyle = IRON_HI; ctx.fillRect(17, 26, 4, 2);
  ctx.fillStyle = FIRE_DEEP; ctx.fillRect(18, 27, 8, 3);
  ctx.fillStyle = FIRE_ORANGE; ctx.fillRect(19, 26, 6, 2);
  ctx.fillStyle = IRON_DARK;
  for (const px of [16, 21, 27]) ctx.fillRect(px, 24, 2, 6);
}

function paintTorchFlames(ctx: CanvasRenderingContext2D, frame: number): void {
  const ph = (frame * Math.PI) / 3;
  const hMain = 23 + Math.round(Math.sin(ph) * 2.5);
  paintFlameTongue(ctx, { bx: 18, baseY: 27, h: 13 + (frame % 3), baseHw: 3.5, lean: -2.8, flutter: 1.2, phase: ph + 1.4, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 26, baseY: 27, h: 12 + ((frame + 1) % 3), baseHw: 3.5, lean: 2.8, flutter: 1.2, phase: ph + 3.2, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 22, baseY: 28, h: hMain, baseHw: 5.5, lean: 2.2, flutter: 1.5, phase: ph, frame, color: FIRE_DEEP });
  paintFlameTongue(ctx, { bx: 22, baseY: 27, h: hMain - 3, baseHw: 4.2, lean: 1.8, flutter: 1.2, phase: ph + 0.3, frame, color: FIRE_BRIGHT });
  paintFlameTongue(ctx, { bx: 22, baseY: 27, h: hMain - 9, baseHw: 2.8, lean: 1.2, flutter: 0.9, phase: ph + 0.6, frame, color: FIRE_GOLD });
  paintFlameTongue(ctx, { bx: 22, baseY: 27, h: 7, baseHw: 1.8, lean: 0.5, flutter: 0.4, phase: ph + 0.8, frame, color: FIRE_CORE });
  paintRisingSparks(ctx, { frame, cx: 22, baseY: 12, spread: 4.5, rise: 9 });
}

/** 6-frame 44x76 iron-brazier torch with multi-tongue pixel flames and rising sparks. */
export function makeHdTorchFrames(): readonly Texture[] {
  return [0, 1, 2, 3, 4, 5].map((frame) => {
    const w = 44; const h = 76;
    const { canvas, ctx } = createPixelCanvas(w, h);
    paintTorchPost(ctx);
    paintTorchFlames(ctx, frame);
    stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
    return canvasToNearestTexture(canvas);
  });
}
