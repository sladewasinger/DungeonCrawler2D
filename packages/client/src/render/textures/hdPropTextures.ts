/** Procedural 3x HD-pixel (48 px/tile) boulder, stump, campfire, torch, and POI fallback textures. */
import type { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel,
  stampSelOutOutline,
} from "./pixelCanvas.js";

export function makeHdBoulderVariants(): readonly Texture[] {
  const themes = [
    { dark: "#3f4a59", mid: "#64748b", light: "#94a3b8", moss: "#4d7c3f" },
    { dark: "#4b4642", mid: "#736b63", light: "#a89f94", moss: null },
    { dark: "#35404f", mid: "#556478", light: "#899ab0", moss: "#5e9148" },
  ];
  return themes.map((t, i) => {
    const w = 66; const h = 54;
    const { canvas, ctx } = createPixelCanvas(w, h);
    fillCluster(ctx, [
      { cx: 33, cy: 32, rx: 22 + (i === 1 ? 2 : 0), ry: 14, color: t.dark },
      { cx: 31, cy: 29, rx: 19, ry: 12, color: t.mid },
      { cx: 26, cy: 23, rx: 12, ry: 7, color: t.light },
      { cx: 43, cy: 34, rx: 8, ry: 6, color: t.dark },
    ]);
    ctx.fillStyle = "#29323d";
    ctx.fillRect(28, 26, 2, 10);
    ctx.fillRect(30, 32, 6, 2);
    if (t.moss) {
      fillEllipsePixel(ctx, { cx: 23, cy: 20, rx: 8, ry: 4, color: t.moss });
      fillEllipsePixel(ctx, { cx: 19, cy: 24, rx: 4, ry: 3, color: "#74ad55" });
    }
    stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
    return canvasToNearestTexture(canvas);
  });
}

export function makeHdStumpTexture(): Texture {
  const w = 54; const h = 48;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 16, cy: 38, rx: 6, ry: 3, color: "#4a2c18" },
    { cx: 38, cy: 38, rx: 6, ry: 3, color: "#3a2112" },
    { cx: 27, cy: 33, rx: 13, ry: 9, color: "#683f22" },
    { cx: 24, cy: 32, rx: 5, ry: 8, color: "#85522d" },
    { cx: 27, cy: 23, rx: 12, ry: 7, color: "#b67c46" },
    { cx: 27, cy: 23, rx: 8, ry: 4, color: "#d6a063" },
    { cx: 27, cy: 23, rx: 4, ry: 2, color: "#b67c46" },
  ]);
  fillEllipsePixel(ctx, { cx: 36, cy: 38, rx: 4, ry: 2, color: "#4a8742" });
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

const FLAME_SHIFTS = [
  { sway: 0, h: 16 }, { sway: -2, h: 19 }, { sway: 1, h: 15 }, { sway: 2, h: 18 },
];

export function makeHdCampfireFrames(): readonly Texture[] {
  return FLAME_SHIFTS.map((f, idx) => {
    const w = 54; const h = 54;
    const { canvas, ctx } = createPixelCanvas(w, h);
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      fillEllipsePixel(ctx, { cx: 27 + Math.cos(ang) * 14, cy: 37 + Math.sin(ang) * 7, rx: 4, ry: 3, color: a > 3 ? "#4b5563" : "#788496" });
    }
    ctx.fillStyle = "#5c341b";
    ctx.fillRect(17, 33, 20, 4);
    ctx.fillRect(21, 30, 12, 8);
    fillCluster(ctx, [
      { cx: 27, cy: 34, rx: 8, ry: 4, color: "#ea580c" },
      { cx: 27 + f.sway, cy: 28 - f.h * 0.25, rx: 7, ry: f.h * 0.52, color: "#f97316" },
      { cx: 27 + f.sway * 1.2, cy: 28 - f.h * 0.18, rx: 4, ry: f.h * 0.36, color: "#facc15" },
      { cx: 27 + f.sway, cy: 30, rx: 2, ry: 3, color: "#fef9c3" },
    ]);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(22 + idx * 3, 12 + (idx % 2) * 3, 2, 2);
    stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
    return canvasToNearestTexture(canvas);
  });
}

export function makeHdTorchFrames(): readonly Texture[] {
  return FLAME_SHIFTS.map((f, idx) => {
    const w = 36; const h = 66;
    const { canvas, ctx } = createPixelCanvas(w, h);
    ctx.fillStyle = "#5a351d";
    ctx.fillRect(15, 28, 6, 30);
    ctx.fillStyle = "#7a4a2a";
    ctx.fillRect(16, 28, 2, 29);
    ctx.fillStyle = "#475569";
    ctx.fillRect(14, 24, 8, 5);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(15, 25, 3, 2);
    fillCluster(ctx, [
      { cx: 18 + f.sway, cy: 19, rx: 6, ry: 9, color: "#ea580c" },
      { cx: 18 + f.sway, cy: 19, rx: 4, ry: 6, color: "#fbbf24" },
      { cx: 18 + f.sway, cy: 20, rx: 2, ry: 3, color: "#fef9c3" },
    ]);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(14 + idx * 2, 6 + (idx % 2) * 2, 2, 2);
    stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
    return canvasToNearestTexture(canvas);
  });
}

export function makeHdFallbackPalisadeTexture(): Texture {
  const w = 60; const h = 96;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (const sx of [16, 30, 44]) {
    fillEllipsePixel(ctx, { cx: sx, cy: 20, rx: 5, ry: 7, color: "#784928" });
    ctx.fillStyle = "#683e20"; ctx.fillRect(sx - 6, 20, 12, 66);
    ctx.fillStyle = "#8a5630"; ctx.fillRect(sx - 3, 20, 4, 65);
  }
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(10, 42, 40, 6);
  ctx.fillStyle = "#b58b52"; ctx.fillRect(12, 41, 4, 8); ctx.fillRect(42, 41, 4, 8);
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

export function makeHdFallbackTentTexture(): Texture {
  const w = 132; const h = 102;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 66, cy: 60, rx: 50, ry: 26, color: "#7c4a2d" },
    { cx: 66, cy: 48, rx: 44, ry: 22, color: "#a4643c" },
    { cx: 56, cy: 42, rx: 26, ry: 14, color: "#bf7d4f" },
    { cx: 66, cy: 70, rx: 14, ry: 16, color: "#231712" },
  ]);
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}

export function makeHdFallbackRuinPillarTexture(): Texture {
  const w = 60; const h = 108;
  const { canvas, ctx } = createPixelCanvas(w, h);
  ctx.fillStyle = "#64748b"; ctx.fillRect(18, 22, 24, 74);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(20, 22, 8, 74);
  ctx.fillStyle = "#475569"; ctx.fillRect(12, 16, 36, 10); ctx.fillRect(12, 88, 36, 10);
  fillEllipsePixel(ctx, { cx: 24, cy: 52, rx: 6, ry: 8, color: "#3d7a3c" });
  stampSelOutOutline(ctx, { w, h, radiusPx: 4 });
  return canvasToNearestTexture(canvas);
}
