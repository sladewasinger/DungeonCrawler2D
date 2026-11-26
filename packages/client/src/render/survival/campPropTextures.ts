/** Procedural 3x HD-pixel (48 px/tile) ore vein and placeable camp structure prop textures. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import type { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel, stampSelOutOutline,
} from "../textures/pixelCanvas.js";

function bakeOreVein(base: readonly [string, string, string], flecks: readonly [string, string]): Texture {
  const w = 66; const h = 54;
  const { canvas, ctx } = createPixelCanvas(w, h);
  fillCluster(ctx, [
    { cx: 33, cy: 32, rx: 22, ry: 14, color: base[0] },
    { cx: 31, cy: 29, rx: 19, ry: 12, color: base[1] },
    { cx: 27, cy: 24, rx: 11, ry: 6, color: base[2] },
  ]);
  for (const [fx, fy] of [[22, 26], [30, 31], [41, 25], [27, 36], [38, 34]] as const) {
    ctx.fillStyle = flecks[0]; ctx.fillRect(fx, fy, 5, 4);
    ctx.fillStyle = flecks[1]; ctx.fillRect(fx + 1, fy + 1, 3, 2);
  }
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}

function makeHdCopperVeinTexture(): Texture {
  return bakeOreVein(["#3b3532", "#5c534c", "#7d7269"], ["#c2591b", "#f59e0b"]);
}

function makeHdIronVeinTexture(): Texture {
  return bakeOreVein(["#2d3540", "#4b5563", "#707d8f"], ["#94a3b8", "#e2e8f0"]);
}

function makeHdWorkbenchTexture(): Texture {
  const w = 66; const h = 60;
  const { canvas, ctx } = createPixelCanvas(w, h);
  ctx.fillStyle = "#4b2c15";
  ctx.fillRect(14, 30, 6, 20); ctx.fillRect(46, 30, 6, 20);
  ctx.fillRect(16, 40, 34, 4);
  ctx.fillStyle = "#7c4724"; ctx.fillRect(10, 22, 46, 11);
  ctx.fillStyle = "#a86739"; ctx.fillRect(12, 18, 42, 6);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(18, 20, 8, 3);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(36, 17, 7, 4);
  ctx.fillStyle = "#d97706"; ctx.fillRect(38, 21, 3, 5);
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}

function makeHdCampBedTexture(): Texture {
  const w = 68; const h = 52;
  const { canvas, ctx } = createPixelCanvas(w, h);
  ctx.fillStyle = "#4b2c15";
  ctx.fillRect(10, 18, 48, 24);
  ctx.fillStyle = "#7c4724";
  ctx.fillRect(12, 15, 44, 5);
  ctx.fillStyle = "#f1f5f9";
  fillEllipsePixel(ctx, { cx: 20, cy: 25, rx: 6, ry: 4, color: "#f1f5f9" });
  ctx.fillStyle = "#b91c1c"; ctx.fillRect(26, 21, 28, 16);
  ctx.fillStyle = "#dc2626"; ctx.fillRect(28, 22, 24, 9);
  ctx.fillStyle = "#5c3518"; ctx.fillRect(12, 38, 6, 6); ctx.fillRect(50, 38, 6, 6);
  stampSelOutOutline(ctx, { w, h, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}

export interface CampPropTextures {
  readonly copperVein: Texture;
  readonly ironVein: Texture;
  readonly workbench: Texture;
  readonly bed: Texture;
}

export function createCampPropTextures(): CampPropTextures {
  return {
    copperVein: makeHdCopperVeinTexture(),
    ironVein: makeHdIronVeinTexture(),
    workbench: makeHdWorkbenchTexture(),
    bed: makeHdCampBedTexture(),
  };
}
