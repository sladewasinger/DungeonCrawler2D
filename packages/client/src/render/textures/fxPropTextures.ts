/** Animated light-emitting props (campfire, torch) and procedural knight sprite fallback. */
import { Texture } from "pixi.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline, type PixelRect } from "./pixelCanvas.js";

export function makeOutlinedTexture(w: number, h: number, rects: readonly PixelRect[]): Texture {
  const { canvas, ctx } = createPixelCanvas(w, h);
  drawRects(ctx, rects);
  stampDarkOutline(ctx, { w, h });
  return canvasToNearestTexture(canvas);
}

export function makeCampfireFrames(): readonly Texture[] {
  return [0, 1, 2, 3].map((f) => {
    const sway = f % 2 === 0 ? 0 : 1;
    return makeOutlinedTexture(24, 24, [
      [4, 14, 16, 6, "#57534e"],
      [6, 13, 12, 5, "#78716c"],
      [7, 14, 10, 3, "#451a03"],
      [8, 12, 8, 4, "#ea580c"],
      [9 + sway, 7 - (f % 2), 6, 7, "#f97316"],
      [10 + sway, 5 + (f % 2), 4, 7, "#facc15"],
      [11, 8, 2, 4, "#fef9c3"],
    ]);
  });
}

export function makeTorchFrames(): readonly Texture[] {
  return [0, 1, 2, 3].map((f) =>
    makeOutlinedTexture(14, 22, [
      [6, 9, 2, 11, "#78350f"],
      [5, 8, 4, 2, "#475569"],
      [5 + (f % 2), 3, 4, 5, "#f97316"],
      [6, 4 - (f % 2), 2, 4, "#fde047"],
    ]),
  );
}

export function makeFallbackKnight(): Texture {
  return makeOutlinedTexture(16, 24, [
    [5, 4, 6, 6, "#94a3b8"],
    [6, 6, 4, 2, "#1e293b"],
    [4, 10, 8, 8, "#3b82f6"],
    [5, 11, 6, 4, "#60a5fa"],
    [5, 18, 2, 4, "#475569"],
    [9, 18, 2, 4, "#475569"],
  ]);
}
