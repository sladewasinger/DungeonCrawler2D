/** Procedural 3x HD-pixel (48 px/tile) ore veins, camp props, wood chests, palisades, and stripped bushes. */
import { ACTIVE_OUTLINE_STYLE } from "@dc2d/content";
import type { Texture } from "pixi.js";
import {
  canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel, stampSelOutOutline,
} from "../textures/pixelCanvas.js";

function finalizeHdCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Texture {
  stampSelOutOutline(ctx, { w: canvas.width, h: canvas.height, solidPx: ACTIVE_OUTLINE_STYLE.propSolidPx });
  return canvasToNearestTexture(canvas);
}

function bakeOreVein(base: readonly [string, string, string], flecks: readonly [string, string]): Texture {
  const { canvas, ctx } = createPixelCanvas(66, 54);
  fillCluster(ctx, [
    { cx: 33, cy: 32, rx: 22, ry: 14, color: base[0] },
    { cx: 31, cy: 29, rx: 19, ry: 12, color: base[1] },
    { cx: 27, cy: 24, rx: 11, ry: 6, color: base[2] },
  ]);
  for (const [fx, fy] of [[22, 26], [30, 31], [41, 25], [27, 36], [38, 34]] as const) {
    ctx.fillStyle = flecks[0]; ctx.fillRect(fx, fy, 5, 4);
    ctx.fillStyle = flecks[1]; ctx.fillRect(fx + 1, fy + 1, 3, 2);
  }
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdWorkbenchTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(66, 60);
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(14, 30, 6, 20); ctx.fillRect(46, 30, 6, 20);
  ctx.fillRect(16, 40, 34, 4);
  ctx.fillStyle = "#7c4724"; ctx.fillRect(10, 22, 46, 11);
  ctx.fillStyle = "#a86739"; ctx.fillRect(12, 18, 42, 6);
  ctx.fillStyle = "#94a3b8"; ctx.fillRect(18, 20, 8, 3);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(36, 17, 7, 4);
  ctx.fillStyle = "#d97706"; ctx.fillRect(38, 21, 3, 5);
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdCampBedTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(68, 52);
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(10, 18, 48, 24);
  ctx.fillStyle = "#7c4724"; ctx.fillRect(12, 15, 44, 5);
  fillEllipsePixel(ctx, { cx: 20, cy: 25, rx: 6, ry: 4, color: "#f1f5f9" });
  ctx.fillStyle = "#b91c1c"; ctx.fillRect(26, 21, 28, 16);
  ctx.fillStyle = "#dc2626"; ctx.fillRect(28, 22, 24, 9);
  ctx.fillStyle = "#5c3518"; ctx.fillRect(12, 38, 6, 6); ctx.fillRect(50, 38, 6, 6);
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdWoodChestTexture(open: boolean): Texture {
  const { canvas, ctx } = createPixelCanvas(54, 54);
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(10, 24, 34, 21);
  ctx.fillStyle = "#7c4724"; ctx.fillRect(12, 26, 30, 17);
  ctx.fillStyle = "#64748b"; ctx.fillRect(12, 32, 30, 3);
  if (open) {
    ctx.fillStyle = "#1c130d"; ctx.fillRect(12, 22, 30, 6);
    ctx.fillStyle = "#5c3518"; ctx.fillRect(10, 12, 34, 10);
    ctx.fillStyle = "#92582c"; ctx.fillRect(12, 13, 30, 6);
  } else {
    ctx.fillStyle = "#92582c"; ctx.fillRect(10, 18, 34, 8);
    ctx.fillStyle = "#b4733d"; ctx.fillRect(12, 19, 30, 4);
    ctx.fillStyle = "#facc15"; ctx.fillRect(25, 25, 4, 6);
  }
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdPalisadeTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(60, 96);
  for (const sx of [16, 30, 44]) {
    fillEllipsePixel(ctx, { cx: sx, cy: 20, rx: 5, ry: 7, color: "#784928" });
    ctx.fillStyle = "#683e20"; ctx.fillRect(sx - 6, 20, 12, 66);
    ctx.fillStyle = "#8a5630"; ctx.fillRect(sx - 3, 20, 4, 65);
  }
  ctx.fillStyle = "#4b2c15"; ctx.fillRect(10, 42, 40, 6);
  ctx.fillStyle = "#b58b52"; ctx.fillRect(12, 41, 4, 8); ctx.fillRect(42, 41, 4, 8);
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdPalisadeRailTexture(horizontal: boolean): Texture {
  const { canvas, ctx } = createPixelCanvas(48, 48);
  if (horizontal) {
    ctx.fillStyle = "#4b2c15"; ctx.fillRect(2, 20, 44, 9);
    ctx.fillStyle = "#7c4724"; ctx.fillRect(2, 21, 44, 5);
  } else {
    ctx.fillStyle = "#4b2c15"; ctx.fillRect(20, 2, 9, 44);
    ctx.fillStyle = "#7c4724"; ctx.fillRect(21, 2, 5, 44);
  }
  return finalizeHdCanvas(canvas, ctx);
}

function makeHdStrippedBushTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(60, 48);
  fillCluster(ctx, [
    { cx: 30, cy: 30, rx: 20, ry: 11, color: "#173c22" },
    { cx: 20, cy: 26, rx: 11, ry: 9, color: "#276338" },
    { cx: 40, cy: 27, rx: 11, ry: 9, color: "#276338" },
    { cx: 30, cy: 21, rx: 13, ry: 10, color: "#3d8746" },
    { cx: 26, cy: 17, rx: 6, ry: 4, color: "#5ba85a" },
  ]);
  return finalizeHdCanvas(canvas, ctx);
}

export interface CampPropTextures {
  readonly copperVein: Texture;
  readonly ironVein: Texture;
  readonly workbench: Texture;
  readonly bed: Texture;
  readonly woodChestClosed: Texture;
  readonly woodChestOpen: Texture;
  readonly palisade: Texture;
  readonly palisadeRailH: Texture;
  readonly palisadeRailV: Texture;
  readonly bushStripped: Texture;
}

export function createCampPropTextures(): CampPropTextures {
  return {
    copperVein: bakeOreVein(["#3b3532", "#5c534c", "#7d7269"], ["#c2591b", "#f59e0b"]),
    ironVein: bakeOreVein(["#2d3540", "#4b5563", "#707d8f"], ["#94a3b8", "#e2e8f0"]),
    workbench: makeHdWorkbenchTexture(),
    bed: makeHdCampBedTexture(),
    woodChestClosed: makeHdWoodChestTexture(false),
    woodChestOpen: makeHdWoodChestTexture(true),
    palisade: makeHdPalisadeTexture(),
    palisadeRailH: makeHdPalisadeRailTexture(true),
    palisadeRailV: makeHdPalisadeRailTexture(false),
    bushStripped: makeHdStrippedBushTexture(),
  };
}
