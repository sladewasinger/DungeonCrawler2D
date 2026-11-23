/** Smooth anti-aliased canvas generators for rounded glossy blood, slime, ichor, and water gore. */
import { Texture } from "pixi.js";

const SUPERSAMPLE = 4;

interface BlobSpec {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

function makeHiResCanvas(logicalW: number, logicalH: number): {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = logicalW * SUPERSAMPLE;
  canvas.height = logicalH * SUPERSAMPLE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function toSmoothTexture(canvas: HTMLCanvasElement): Texture {
  return Texture.from({ resource: canvas, resolution: SUPERSAMPLE, scaleMode: "linear" });
}

function drawLiquidBlob(ctx: CanvasRenderingContext2D, spec: BlobSpec): void {
  const grad = ctx.createRadialGradient(spec.x - spec.r * 0.25, spec.y - spec.r * 0.28, spec.r * 0.1, spec.x, spec.y, spec.r);
  grad.addColorStop(0, "rgba(255,255,255,0.98)");
  grad.addColorStop(0.55, "rgba(226,226,226,0.95)");
  grad.addColorStop(0.86, "rgba(176,176,176,0.9)");
  grad.addColorStop(1, "rgba(125,125,125,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(spec.x, spec.y, spec.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlossHighlight(ctx: CanvasRenderingContext2D, spec: { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }): void {
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.beginPath();
  ctx.ellipse(spec.cx, spec.cy, spec.rx, spec.ry, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

function buildBlobClusterTexture(size: { readonly w: number; readonly h: number }, blobs: readonly BlobSpec[], spec: boolean): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const { canvas, ctx } = makeHiResCanvas(size.w, size.h);
  for (const b of blobs) drawLiquidBlob(ctx, b);
  if (spec && blobs[0]) {
    drawGlossHighlight(ctx, { cx: blobs[0].x - blobs[0].r * 0.26, cy: blobs[0].y - blobs[0].r * 0.28, rx: blobs[0].r * 0.34, ry: blobs[0].r * 0.18 });
  }
  return toSmoothTexture(canvas);
}

const SPLAT_CLUSTERS: readonly (readonly BlobSpec[])[] = [
  [{ x: 5.5, y: 3.6, r: 2.8 }, { x: 8.6, y: 3.8, r: 1.5 }, { x: 10.7, y: 1.7, r: 0.9 }],
  [{ x: 6.8, y: 3.3, r: 2.6 }, { x: 3.4, y: 2.5, r: 1.4 }, { x: 10.3, y: 4.5, r: 1.0 }],
  [{ x: 7.2, y: 3.4, r: 2.5 }, { x: 4.1, y: 4.3, r: 1.5 }, { x: 1.8, y: 2.0, r: 1.1 }],
  [{ x: 4.6, y: 3.0, r: 2.4 }, { x: 7.9, y: 3.2, r: 1.4 }, { x: 10.6, y: 4.1, r: 0.9 }],
];

const GOOP_CLUSTERS: readonly (readonly BlobSpec[])[] = [
  [{ x: 5.0, y: 3.2, r: 2.8 }, { x: 7.2, y: 3.5, r: 1.6 }],
  [{ x: 5.2, y: 2.8, r: 2.6 }, { x: 2.9, y: 3.0, r: 1.5 }],
  [{ x: 4.4, y: 2.9, r: 2.5 }, { x: 6.7, y: 2.4, r: 1.4 }],
];

const POOL_CLUSTERS: readonly (readonly BlobSpec[])[] = [
  [{ x: 10.8, y: 4.2, r: 3.9 }, { x: 15.2, y: 4.5, r: 3.1 }, { x: 6.5, y: 4.4, r: 2.5 }, { x: 19.3, y: 4.0, r: 1.9 }],
  [{ x: 12.2, y: 4.0, r: 3.7 }, { x: 7.8, y: 3.8, r: 2.9 }, { x: 16.5, y: 4.4, r: 2.6 }, { x: 20.4, y: 5.0, r: 1.6 }],
];

function buildArcTexture(curve: number, tailR: number): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const { canvas, ctx } = makeHiResCanvas(22, 6);
  ctx.lineCap = "round";
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const x = 2 + t * 17;
    const y = 4.4 - Math.sin(t * Math.PI) * curve;
    const r = Math.max(0.55, Math.sin(t * Math.PI * 0.9 + 0.15) * 1.45 * (1 - t * 0.25));
    drawLiquidBlob(ctx, { x, y, r });
  }
  drawLiquidBlob(ctx, { x: 20.2, y: 4.3, r: tailR });
  return toSmoothTexture(canvas);
}

function buildStreakTexture(spreadY: number): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const { canvas, ctx } = makeHiResCanvas(14, 5);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 2.2 + t * 8.6;
    const y = 2.5 + (t - 0.5) * spreadY;
    drawLiquidBlob(ctx, { x, y, r: Math.max(0.55, 1.8 * (1 - t * 0.72)) });
  }
  drawLiquidBlob(ctx, { x: 12.2, y: 2.5 + spreadY * 0.55, r: 0.72 });
  return toSmoothTexture(canvas);
}

function buildWaterPlumeTexture(rx: number, ry: number): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const { canvas, ctx } = makeHiResCanvas(18, 9);
  const g = ctx.createRadialGradient(8.5, 4.5, 0.8, 9, 4.5, rx);
  g.addColorStop(0, "rgba(255,255,255,0.82)");
  g.addColorStop(0.45, "rgba(255,255,255,0.48)");
  g.addColorStop(0.82, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(9, 4.5, rx, ry, 0.12, 0, Math.PI * 2);
  ctx.fill();
  return toSmoothTexture(canvas);
}

function buildFootprintTexture(shift: number): Texture {
  if (typeof document === "undefined") return Texture.WHITE;
  const { canvas, ctx } = makeHiResCanvas(6, 6);
  ctx.fillStyle = "rgba(224,224,224,0.88)";
  ctx.beginPath();
  ctx.ellipse(2.6 + shift, 2.0, 1.45, 1.1, 0, 0, Math.PI * 2);
  ctx.ellipse(2.8 - shift, 4.4, 1.15, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  return toSmoothTexture(canvas);
}

export function buildSmoothLiquidGoreTextures() {
  return {
    splatters: SPLAT_CLUSTERS.map((c) => buildBlobClusterTexture({ w: 12, h: 7 }, c, true)),
    arcs: [buildArcTexture(2.6, 0.75), buildArcTexture(2.2, 0.9), buildArcTexture(2.9, 0.65)],
    streaks: [buildStreakTexture(0.2), buildStreakTexture(-0.5), buildStreakTexture(0.6)],
    goopBlobs: GOOP_CLUSTERS.map((c) => buildBlobClusterTexture({ w: 10, h: 6 }, c, true)),
    goopPuddles: POOL_CLUSTERS.map((c) => buildBlobClusterTexture({ w: 24, h: 8 }, c, true)),
    pools: POOL_CLUSTERS.map((c) => buildBlobClusterTexture({ w: 24, h: 8 }, c, true)),
    waterPlumes: [buildWaterPlumeTexture(8.0, 3.8), buildWaterPlumeTexture(7.4, 3.5)],
    footprints: [buildFootprintTexture(0.35), buildFootprintTexture(-0.35)],
    droplet: buildBlobClusterTexture({ w: 5, h: 5 }, [{ x: 2.5, y: 2.5, r: 1.95 }], true),
  };
}