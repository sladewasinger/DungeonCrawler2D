/** Procedural 48 px/tile HD pixel-art props for Autumn Woods, Misty Bog, and Cursed Ruinlands. */
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, fillCluster, fillEllipsePixel, stampSelOutOutline } from "../pixelCanvas.js";

export interface BiomePropTextures {
  readonly birchTrunk: Texture;
  readonly birchCanopy: Texture;
  readonly mapleTrunk: Texture;
  readonly mapleCanopy: Texture;
  readonly deadTree: Texture;
  readonly giantMushroom: Texture;
  readonly bogReed: Texture;
  readonly cursedCrystal: Texture;
}

function makeBirchTrunkTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(48, 64);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(20, 14, 8, 44);
  ctx.fillStyle = "#f8fafc"; ctx.fillRect(21, 14, 5, 44);
  for (const y of [20, 28, 37, 46, 52]) {
    ctx.fillStyle = "#334155"; ctx.fillRect(20, y, 5, 2);
  }
  stampSelOutOutline(ctx, { w: 48, h: 64 });
  return canvasToNearestTexture(canvas);
}

function makeMapleTrunkTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(54, 66);
  ctx.fillStyle = "#472c1c"; ctx.fillRect(22, 16, 10, 44);
  ctx.fillStyle = "#6e472b"; ctx.fillRect(23, 16, 6, 44);
  ctx.fillStyle = "#331e12"; ctx.fillRect(18, 56, 18, 5);
  stampSelOutOutline(ctx, { w: 54, h: 66 });
  return canvasToNearestTexture(canvas);
}

function makeCanopyTexture(colors: { readonly dark: string; readonly mid: string; readonly hi: string }): Texture {
  const { canvas, ctx } = createPixelCanvas(74, 62);
  fillCluster(ctx, [
    { cx: 37, cy: 32, rx: 27, ry: 20, color: colors.dark },
    { cx: 24, cy: 36, rx: 16, ry: 14, color: colors.dark },
    { cx: 50, cy: 36, rx: 16, ry: 14, color: colors.dark },
    { cx: 37, cy: 26, rx: 24, ry: 17, color: colors.mid },
    { cx: 23, cy: 30, rx: 13, ry: 11, color: colors.mid },
    { cx: 49, cy: 30, rx: 13, ry: 11, color: colors.mid },
    { cx: 33, cy: 20, rx: 16, ry: 11, color: colors.hi },
    { cx: 45, cy: 23, rx: 10, ry: 8, color: colors.hi },
  ]);
  stampSelOutOutline(ctx, { w: 74, h: 62 });
  return canvasToNearestTexture(canvas);
}

function makeDeadTreeTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(54, 66);
  ctx.fillStyle = "#475569"; ctx.fillRect(23, 20, 8, 40);
  ctx.fillStyle = "#64748b"; ctx.fillRect(24, 20, 4, 40);
  ctx.fillStyle = "#475569";
  ctx.fillRect(14, 18, 12, 3); ctx.fillRect(29, 24, 12, 3);
  ctx.fillRect(12, 12, 4, 8); ctx.fillRect(38, 16, 4, 10);
  stampSelOutOutline(ctx, { w: 54, h: 66 });
  return canvasToNearestTexture(canvas);
}

function makeGiantMushroomTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(48, 52);
  ctx.fillStyle = "#cbd5e1"; ctx.fillRect(20, 24, 8, 22);
  ctx.fillStyle = "#f1f5f9"; ctx.fillRect(21, 24, 5, 22);
  fillCluster(ctx, [
    { cx: 24, cy: 21, rx: 17, ry: 11, color: "#0f766e" },
    { cx: 24, cy: 19, rx: 15, ry: 9, color: "#14b8a6" },
    { cx: 18, cy: 17, rx: 3, ry: 2, color: "#99f6e4" },
    { cx: 29, cy: 20, rx: 3, ry: 2, color: "#99f6e4" },
    { cx: 24, cy: 14, rx: 2, ry: 2, color: "#ccfbf1" },
  ]);
  stampSelOutOutline(ctx, { w: 48, h: 52 });
  return canvasToNearestTexture(canvas);
}

function makeBogReedTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(36, 44);
  for (const [x, h] of [[10, 26], [17, 32], [24, 24]] as const) {
    ctx.fillStyle = "#166534"; ctx.fillRect(x, 40 - h, 2, h);
    ctx.fillStyle = "#78350f"; ctx.fillRect(x - 1, 40 - h + 2, 4, 7);
  }
  stampSelOutOutline(ctx, { w: 36, h: 44 });
  return canvasToNearestTexture(canvas);
}

function makeCursedCrystalTexture(): Texture {
  const { canvas, ctx } = createPixelCanvas(48, 54);
  fillEllipsePixel(ctx, { cx: 24, cy: 44, rx: 14, ry: 5, color: "#312e81" });
  ctx.fillStyle = "#6b21a8"; ctx.fillRect(19, 10, 10, 34);
  ctx.fillStyle = "#a855f7"; ctx.fillRect(21, 8, 6, 35);
  ctx.fillStyle = "#e879f9"; ctx.fillRect(22, 11, 2, 26);
  ctx.fillStyle = "#7e22ce"; ctx.fillRect(12, 22, 6, 22);
  ctx.fillRect(30, 24, 6, 20);
  stampSelOutOutline(ctx, { w: 48, h: 54 });
  return canvasToNearestTexture(canvas);
}

export function createBiomePropTextures(): BiomePropTextures {
  return {
    birchTrunk: makeBirchTrunkTexture(),
    birchCanopy: makeCanopyTexture({ dark: "#9a6b16", mid: "#d99b26", hi: "#facc15" }),
    mapleTrunk: makeMapleTrunkTexture(),
    mapleCanopy: makeCanopyTexture({ dark: "#7f1d1d", mid: "#c2410c", hi: "#f97316" }),
    deadTree: makeDeadTreeTexture(),
    giantMushroom: makeGiantMushroomTexture(),
    bogReed: makeBogReedTexture(),
    cursedCrystal: makeCursedCrystalTexture(),
  };
}
