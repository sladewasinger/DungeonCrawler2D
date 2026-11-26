/** Procedural 48 px/tile HD pixel-art textures for the 14 frontier POI props. */
import type { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, fillEllipsePixel, stampSelOutOutline } from "../pixelCanvas.js";

export interface FrontierPoiTextures {
  readonly shrineAltar: Texture;
  readonly waystone: Texture;
  readonly gravestone: Texture;
  readonly brokenCart: Texture;
  readonly greatStump: Texture;
  readonly sunkenBoat: Texture;
  readonly loreSign: Texture;
  readonly boneTotem: Texture;
  readonly runicForge: Texture;
  readonly cursedObelisk: Texture;
  readonly brazierUnlit: Texture;
  readonly brazierLit: Texture;
  readonly hermitHut: Texture;
  readonly fairyRing: Texture;
}

function boxSprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const { canvas, ctx } = createPixelCanvas(w, h);
  paint(ctx);
  stampSelOutOutline(ctx, { w, h });
  return canvasToNearestTexture(canvas);
}

function makeShrineAltar(): Texture {
  return boxSprite(48, 52, (ctx) => {
    ctx.fillStyle = "#475569"; ctx.fillRect(10, 32, 28, 12);
    ctx.fillStyle = "#64748b"; ctx.fillRect(14, 18, 20, 16);
    ctx.fillStyle = "#94a3b8"; ctx.fillRect(11, 14, 26, 6);
    ctx.fillStyle = "#38bdf8"; ctx.fillRect(19, 20, 10, 8);
    ctx.fillStyle = "#e0f2fe"; ctx.fillRect(22, 22, 4, 4);
  });
}

function makeWaystone(): Texture {
  return boxSprite(48, 66, (ctx) => {
    ctx.fillStyle = "#475569"; ctx.fillRect(11, 50, 26, 10);
    ctx.fillStyle = "#64748b"; ctx.fillRect(16, 14, 16, 38);
    ctx.fillStyle = "#94a3b8"; ctx.fillRect(19, 8, 10, 8);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(22, 20, 4, 10); ctx.fillRect(20, 34, 8, 3);
    ctx.fillStyle = "#bae6fd"; ctx.fillRect(23, 22, 2, 6);
  });
}

function makeGravestone(): Texture {
  return boxSprite(40, 46, (ctx) => {
    ctx.fillStyle = "#3f6212"; ctx.fillRect(8, 36, 24, 6);
    ctx.fillStyle = "#64748b"; ctx.fillRect(12, 12, 16, 26);
    ctx.fillStyle = "#94a3b8"; ctx.fillRect(14, 10, 12, 4);
    ctx.fillStyle = "#334155"; ctx.fillRect(18, 17, 4, 10); ctx.fillRect(15, 20, 10, 3);
  });
}

function makeBrokenCart(): Texture {
  return boxSprite(64, 48, (ctx) => {
    ctx.fillStyle = "#5c3a21"; ctx.fillRect(10, 18, 38, 16);
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(12, 20, 34, 10);
    ctx.fillStyle = "#3f2614"; ctx.fillRect(6, 28, 10, 4); ctx.fillRect(46, 24, 10, 4);
    fillEllipsePixel(ctx, { cx: 20, cy: 36, rx: 7, ry: 7, color: "#4a2c18" });
    fillEllipsePixel(ctx, { cx: 20, cy: 36, rx: 3, ry: 3, color: "#94a3b8" });
    fillEllipsePixel(ctx, { cx: 44, cy: 34, rx: 6, ry: 6, color: "#4a2c18" });
  });
}

function makeGreatStump(): Texture {
  return boxSprite(68, 56, (ctx) => {
    fillEllipsePixel(ctx, { cx: 34, cy: 38, rx: 24, ry: 12, color: "#4a2c18" });
    ctx.fillStyle = "#6e4425"; ctx.fillRect(16, 18, 36, 22);
    fillEllipsePixel(ctx, { cx: 34, cy: 18, rx: 18, ry: 8, color: "#c2925e" });
    ctx.fillStyle = "#1c1917"; ctx.fillRect(28, 28, 12, 14);
    ctx.fillStyle = "#facc15"; ctx.fillRect(32, 32, 4, 4);
  });
}

function makeSunkenBoat(): Texture {
  return boxSprite(64, 44, (ctx) => {
    fillEllipsePixel(ctx, { cx: 32, cy: 26, rx: 24, ry: 10, color: "#4a2c18" });
    fillEllipsePixel(ctx, { cx: 32, cy: 24, rx: 20, ry: 7, color: "#6e4425" });
    ctx.fillStyle = "#1e293b"; ctx.fillRect(20, 21, 24, 6);
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(28, 15, 4, 16);
  });
}

function makeLoreSign(): Texture {
  return boxSprite(36, 44, (ctx) => {
    ctx.fillStyle = "#4a2c18"; ctx.fillRect(16, 22, 4, 18);
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(8, 10, 20, 14);
    ctx.fillStyle = "#cbd5e1"; ctx.fillRect(11, 13, 14, 2); ctx.fillRect(11, 17, 10, 2);
  });
}

function makeBoneTotem(): Texture {
  return boxSprite(44, 56, (ctx) => {
    ctx.fillStyle = "#5c3a21"; ctx.fillRect(18, 18, 8, 32);
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(14, 10, 16, 12);
    ctx.fillStyle = "#0f172a"; ctx.fillRect(17, 15, 3, 3); ctx.fillRect(24, 15, 3, 3);
    ctx.fillStyle = "#b91c1c"; ctx.fillRect(12, 26, 20, 4);
  });
}

function makeRunicForge(): Texture {
  return boxSprite(58, 52, (ctx) => {
    ctx.fillStyle = "#334155"; ctx.fillRect(10, 24, 38, 22);
    ctx.fillStyle = "#475569"; ctx.fillRect(14, 14, 30, 14);
    ctx.fillStyle = "#ea580c"; ctx.fillRect(18, 28, 22, 10);
    ctx.fillStyle = "#facc15"; ctx.fillRect(22, 31, 14, 5);
    ctx.fillStyle = "#38bdf8"; ctx.fillRect(16, 18, 4, 4); ctx.fillRect(38, 18, 4, 4);
  });
}

function makeCursedObelisk(): Texture {
  return boxSprite(52, 68, (ctx) => {
    ctx.fillStyle = "#1e1b4b"; ctx.fillRect(12, 52, 28, 10);
    ctx.fillStyle = "#312e81"; ctx.fillRect(16, 14, 20, 40);
    ctx.fillStyle = "#4c1d95"; ctx.fillRect(20, 8, 12, 8);
    ctx.fillStyle = "#c084fc"; ctx.fillRect(24, 18, 4, 14); ctx.fillRect(21, 36, 10, 4);
  });
}

function makeBrazier(lit: boolean): Texture {
  return boxSprite(42, 46, (ctx) => {
    ctx.fillStyle = "#334155"; ctx.fillRect(16, 24, 10, 16);
    ctx.fillStyle = "#475569"; ctx.fillRect(10, 18, 22, 8);
    ctx.fillStyle = "#1e293b"; ctx.fillRect(13, 16, 16, 4);
    if (!lit) return;
    ctx.fillStyle = "#ea580c"; ctx.fillRect(14, 9, 14, 9);
    ctx.fillStyle = "#facc15"; ctx.fillRect(17, 6, 8, 10);
    ctx.fillStyle = "#fef9c3"; ctx.fillRect(19, 10, 4, 5);
  });
}

function makeHermitHut(): Texture {
  return boxSprite(72, 66, (ctx) => {
    ctx.fillStyle = "#6e4425"; ctx.fillRect(12, 30, 48, 28);
    ctx.fillStyle = "#3f6212"; ctx.fillRect(8, 14, 56, 18);
    ctx.fillStyle = "#4d7c0f"; ctx.fillRect(14, 8, 44, 10);
    ctx.fillStyle = "#331e12"; ctx.fillRect(30, 38, 12, 20);
    ctx.fillStyle = "#facc15"; ctx.fillRect(18, 38, 8, 8);
  });
}

function makeFairyRing(): Texture {
  const { canvas, ctx } = createPixelCanvas(64, 44);
  for (const [x, y] of [[32, 6], [14, 14], [50, 14], [10, 26], [54, 26], [22, 36], [42, 36]] as const) {
    fillEllipsePixel(ctx, { cx: x, cy: y, rx: 3, ry: 2, color: "#5eead4" });
  }
  return canvasToNearestTexture(canvas);
}

export function createFrontierPoiTextures(): FrontierPoiTextures {
  return {
    shrineAltar: makeShrineAltar(),
    waystone: makeWaystone(),
    gravestone: makeGravestone(),
    brokenCart: makeBrokenCart(),
    greatStump: makeGreatStump(),
    sunkenBoat: makeSunkenBoat(),
    loreSign: makeLoreSign(),
    boneTotem: makeBoneTotem(),
    runicForge: makeRunicForge(),
    cursedObelisk: makeCursedObelisk(),
    brazierUnlit: makeBrazier(false),
    brazierLit: makeBrazier(true),
    hermitHut: makeHermitHut(),
    fairyRing: makeFairyRing(),
  };
}
