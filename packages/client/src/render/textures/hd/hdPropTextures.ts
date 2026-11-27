/** Procedural 3x HD-pixel (48 px/tile) boulder, broad cut stump, and POI fallbacks. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import type { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel, stampSelOutOutline,
} from "../pixelCanvas.js";

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
    stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
    return canvasToNearestTexture(canvas);
  });
}

export function makeHdStumpTexture(): Texture {
  const w = 56; const h = 44;
  const { canvas, ctx } = createPixelCanvas(w, h);
  for (let y = 21; y <= 35; y++) {
    const t = (y - 21) / 14;
    const hw = Math.round(11 + t * t * 6);
    const leftExtra = t > 0.65 ? Math.round((t - 0.65) * 14) : 0;
    const rightExtra = t > 0.72 ? Math.round((t - 0.72) * 10) : 0;
    ctx.fillStyle = "#4a2c18";
    ctx.fillRect(28 - hw - leftExtra, y, hw * 2 + leftExtra + rightExtra, 1);
    ctx.fillStyle = "#683f22";
    ctx.fillRect(28 - hw - Math.floor(leftExtra * 0.7), y, Math.round(hw * 1.45) + leftExtra, 1);
    ctx.fillStyle = "#8a5a36";
    ctx.fillRect(28 - hw + 1, y, Math.max(2, Math.round(hw * 0.5)), 1);
  }
  fillCluster(ctx, [
    { cx: 28, cy: 19, rx: 12, ry: 6, color: "#cfa067" },
    { cx: 28, cy: 19, rx: 9, ry: 4.5, color: "#e6c38d" },
    { cx: 28, cy: 19, rx: 5.5, ry: 2.5, color: "#c28e54" },
    { cx: 28, cy: 19, rx: 2, ry: 1.2, color: "#8c592c" },
  ]);
  ctx.fillStyle = "#5c3518"; ctx.fillRect(29, 19, 8, 2);
  fillEllipsePixel(ctx, { cx: 38, cy: 33, rx: 4, ry: 2, color: "#4a8742" });
  fillEllipsePixel(ctx, { cx: 40, cy: 31, rx: 2, ry: 2, color: "#6ec45e" });
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
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
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
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
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}

export function makeHdFallbackRuinPillarTexture(): Texture {
  const w = 60; const h = 108;
  const { canvas, ctx } = createPixelCanvas(w, h);
  ctx.fillStyle = "#64748b"; ctx.fillRect(18, 22, 24, 74);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(20, 22, 8, 74);
  ctx.fillStyle = "#475569"; ctx.fillRect(12, 16, 36, 10); ctx.fillRect(12, 88, 36, 10);
  fillEllipsePixel(ctx, { cx: 24, cy: 52, rx: 6, ry: 8, color: "#3d7a3c" });
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}
