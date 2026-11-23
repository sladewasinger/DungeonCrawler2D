/** Procedural 3x HD-pixel (48 px/tile) foliage & tree textures with Borderlands sel-out ink outlines. */
import type { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel,
  seededPixelNoise, stampSelOutOutline, type PixelEllipseSpec,
} from "./pixelCanvas.js";

function paintBarkLines(ctx: CanvasRenderingContext2D, opts: {
  readonly cx: number; readonly top: number; readonly h: number; readonly w: number;
}): void {
  for (let i = 0; i < 9; i++) {
    const ox = (seededPixelNoise(i, 1, 7) - 0.5) * opts.w;
    const x = Math.round(opts.cx + ox);
    const y0 = Math.round(opts.top + seededPixelNoise(i, 2, 11) * (opts.h * 0.4));
    const len = 8 + Math.round(seededPixelNoise(i, 3, 19) * 14);
    ctx.fillStyle = i % 3 === 0 ? "#8a5a36" : "#3a2214";
    ctx.fillRect(x, y0, 2, Math.min(len, opts.top + opts.h - y0));
  }
}

const BARK_DARK = "#4a2c18";

export function makeHdOakTrunkTexture(): Texture {
  const w = 54; const h = 66;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 18, cy: 56, rx: 7, ry: 4, color: BARK_DARK },
    { cx: 36, cy: 56, rx: 7, ry: 4, color: "#3d2413" },
    { cx: 27, cy: 54, rx: 12, ry: 5, color: "#5c381f" },
    { cx: 27, cy: 36, rx: 9, ry: 21, color: "#6e4425" },
    { cx: 24, cy: 34, rx: 4, ry: 18, color: "#8a5a36" },
    { cx: 31, cy: 38, rx: 4, ry: 16, color: BARK_DARK },
    { cx: 20, cy: 20, rx: 6, ry: 3, color: "#5c381f" },
    { cx: 34, cy: 22, rx: 6, ry: 3, color: BARK_DARK },
  ]);
  paintBarkLines(ctx, { cx: 27, top: 18, h: 38, w: 12 });
  fillEllipsePixel(ctx, { cx: 27, cy: 39, rx: 2.5, ry: 3.5, color: "#26160c" });
  fillEllipsePixel(ctx, { cx: 19, cy: 54, rx: 3, ry: 2, color: "#3f7a38" });
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

export function makeHdPineTrunkTexture(): Texture {
  const w = 48; const h = 60;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 17, cy: 51, rx: 5, ry: 3, color: "#422316" },
    { cx: 31, cy: 51, rx: 5, ry: 3, color: "#361b10" },
    { cx: 24, cy: 49, rx: 8, ry: 4, color: "#57301e" },
    { cx: 24, cy: 31, rx: 6, ry: 21, color: "#6b3c26" },
    { cx: 22, cy: 30, rx: 3, ry: 18, color: "#874e34" },
    { cx: 27, cy: 32, rx: 3, ry: 18, color: "#4a2717" },
  ]);
  paintBarkLines(ctx, { cx: 24, top: 14, h: 36, w: 8 });
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

const OAK_LOBES: readonly PixelEllipseSpec[] = [
  { cx: 44, cy: 76, rx: 26, ry: 21, color: "#1c4a2b" }, { cx: 98, cy: 76, rx: 26, ry: 21, color: "#1c4a2b" },
  { cx: 72, cy: 84, rx: 34, ry: 22, color: "#183e25" }, { cx: 72, cy: 52, rx: 36, ry: 28, color: "#276438" },
  { cx: 44, cy: 62, rx: 24, ry: 19, color: "#2b6f3d" }, { cx: 96, cy: 62, rx: 24, ry: 19, color: "#245b33" },
  { cx: 72, cy: 44, rx: 29, ry: 22, color: "#388e49" }, { cx: 52, cy: 46, rx: 19, ry: 15, color: "#43a351" },
  { cx: 88, cy: 46, rx: 18, ry: 14, color: "#388e49" }, { cx: 68, cy: 34, rx: 21, ry: 14, color: "#5ec058" },
  { cx: 54, cy: 36, rx: 12, ry: 9, color: "#7ad662" }, { cx: 79, cy: 30, rx: 10, ry: 7, color: "#8be36b" },
];

export function makeHdOakCanopyTexture(): Texture {
  const w = 144; const h = 120;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, OAK_LOBES);
  for (let i = 0; i < 42; i++) {
    const lx = 28 + Math.round(seededPixelNoise(i, 5, 3) * 86);
    const ly = 22 + Math.round(seededPixelNoise(i, 8, 5) * 66);
    const c = i % 3 === 0 ? "#8be36b" : i % 2 === 0 ? "#245b33" : "#4eb254";
    fillEllipsePixel(ctx, { cx: lx, cy: ly, rx: 3, ry: 2, color: c });
  }
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

export function makeHdPineCanopyTexture(): Texture {
  const w = 120; const h = 138;
  const { canvas, ctx } = createPixelCanvas(w, h);
  const tiers = [
    { cy: 96, rx: 46, ry: 18 },
    { cy: 74, rx: 38, ry: 16 },
    { cy: 52, rx: 30, ry: 14 },
    { cy: 32, rx: 20, ry: 12 },
  ];
  for (const t of tiers) {
    fillEllipsePixel(ctx, { cx: 60, cy: t.cy + 5, rx: t.rx, ry: t.ry * 0.72, color: "#153628" });
    fillEllipsePixel(ctx, { cx: 60, cy: t.cy, rx: t.rx - 2, ry: t.ry * 0.72, color: "#1e5138" });
    fillEllipsePixel(ctx, { cx: 55, cy: t.cy - 4, rx: t.rx * 0.74, ry: t.ry * 0.56, color: "#2d714a" });
    fillEllipsePixel(ctx, { cx: 52, cy: t.cy - 7, rx: t.rx * 0.45, ry: t.ry * 0.36, color: "#43945b" });
  }
  fillEllipsePixel(ctx, { cx: 60, cy: 17, rx: 8, ry: 9, color: "#2d714a" });
  fillEllipsePixel(ctx, { cx: 58, cy: 14, rx: 4, ry: 6, color: "#52ad68" });
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

const BUSH_SPECS = [
  { berry: null, main: "#2c733d", hi: "#52ad59" },
  { berry: "#e11d48", main: "#256338", hi: "#4a9e52" },
  { berry: "#f59e0b", main: "#317a40", hi: "#68c260" },
] as const;

function paintBushTexture(s: { readonly berry: string | null; readonly main: string; readonly hi: string }, v: number): Texture {
  const w = 60; const h = 48;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 30, cy: 30, rx: 20, ry: 11, color: "#173c22" },
    { cx: 20, cy: 26, rx: 11, ry: 9, color: s.main },
    { cx: 40, cy: 27, rx: 11, ry: 9, color: s.main },
    { cx: 30, cy: 21, rx: 13, ry: 10, color: s.hi },
    { cx: 26, cy: 17, rx: 7, ry: 5, color: "#7ed968" },
  ]);
  if (s.berry) {
    ctx.fillStyle = s.berry;
    for (let i = 0; i < 6; i++) {
      const bx = 18 + Math.round(seededPixelNoise(v, i, 2) * 24);
      const by = 16 + Math.round(seededPixelNoise(i, v, 9) * 14);
      ctx.fillRect(bx, by, 3, 3);
    }
  }
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

export function makeHdBushVariants(): readonly Texture[] {
  return BUSH_SPECS.map((s, v) => paintBushTexture(s, v));
}

const bladeWidth = (t: number): number => (t > 0.72 ? 1 : t > 0.35 ? 2 : 3);

function paintBlade(ctx: CanvasRenderingContext2D, opts: {
  readonly baseX: number; readonly baseY: number; readonly h: number; readonly lean: number; readonly color: string; readonly tipColor: string;
}): void {
  for (let i = 0; i < opts.h; i++) {
    const t = i / opts.h;
    const x = Math.round(opts.baseX + opts.lean * t * t);
    ctx.fillStyle = t > 0.7 ? opts.tipColor : opts.color;
    ctx.fillRect(x, opts.baseY - i, bladeWidth(t), 1);
  }
}

export function makeHdTallGrassVariants(): readonly Texture[] {
  return [0, 1, 2].map((v) => {
    const w = 42; const h = 48;
    const { canvas, ctx } = createPixelCanvas(w, h);
    const blades = [
      { bx: 11 + v, lean: -7 - v, h: 24, c: "#2c6e34", tc: "#67b855" },
      { bx: 16, lean: -4, h: 31 + v * 2, c: "#3a853c", tc: "#88d464" },
      { bx: 20, lean: v === 1 ? 2 : -1, h: 34, c: "#439941", tc: "#a6e56e" },
      { bx: 24, lean: 5, h: 29, c: "#347838", tc: "#7ec95e" },
      { bx: 28 - v, lean: 8, h: 23 + v, c: "#286130", tc: "#5ca84f" },
    ];
    for (const b of blades) paintBlade(ctx, { baseX: b.bx, baseY: 43, h: b.h, lean: b.lean, color: b.c, tipColor: b.tc });
    fillEllipsePixel(ctx, { cx: 21, cy: 42, rx: 9, ry: 3, color: "#1c4724" });
    stampSelOutOutline(ctx, { w, h, radiusPx: 3 });
    return canvasToNearestTexture(canvas);
  });
}

export function makeHdWildflowerVariants(): readonly Texture[] {
  const blooms = [
    { petal: "#f43f5e", center: "#fde047" },
    { petal: "#facc15", center: "#92400e" },
    { petal: "#818cf8", center: "#fef08a" },
  ];
  return blooms.map((b, v) => {
    const w = 42; const h = 48;
    const { canvas, ctx } = createPixelCanvas(w, h);
    const stems = [
      { x: 13, h: 20 + v, lean: -4 },
      { x: 21, h: 28, lean: v === 1 ? 1 : -1 },
      { x: 28, h: 22, lean: 4 },
    ];
    for (const st of stems) {
      paintBlade(ctx, { baseX: st.x, baseY: 43, h: st.h, lean: st.lean, color: "#2d7536", tipColor: "#4da34d" });
      const fx = st.x + st.lean;
      const fy = 43 - st.h;
      fillEllipsePixel(ctx, { cx: fx, cy: fy, rx: 4, ry: 4, color: b.petal });
      ctx.fillStyle = b.center;
      ctx.fillRect(fx - 1, fy - 1, 3, 3);
    }
    fillCluster(ctx, [
      { cx: 16, cy: 40, rx: 5, ry: 3, color: "#34843d" },
      { cx: 26, cy: 40, rx: 5, ry: 3, color: "#266130" },
    ]);
    stampSelOutOutline(ctx, { w, h, radiusPx: 3 });
    return canvasToNearestTexture(canvas);
  });
}
