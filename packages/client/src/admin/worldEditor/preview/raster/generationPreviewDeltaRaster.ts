import type { GenerationPreviewProjection } from "../generationPreviewProjection.js";

export interface GenerationPreviewDeltaRaster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

const DELTA_CHANNELS = [105, 255, 80, 150] as const;

export function createGenerationPreviewDeltaRaster(
  mask: Uint8Array,
  width: number,
  height: number,
): GenerationPreviewDeltaRaster {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    if (mask[index] === 1) pixels.set(DELTA_CHANNELS, index * 4);
  }
  return { width, height, pixels };
}

export function drawGenerationPreviewDeltaRaster(input: {
  readonly context: CanvasRenderingContext2D;
  readonly mask: Uint8Array;
  readonly projection: GenerationPreviewProjection;
}): void {
  if (typeof input.context.drawImage !== "function") return;
  const ownerDocument = input.context.canvas.ownerDocument ?? globalThis.document;
  if (!ownerDocument) return;
  const canvas = ownerDocument.createElement("canvas");
  const { width, height } = input.projection.bounds;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const raster = createGenerationPreviewDeltaRaster(input.mask, width, height);
  const image = context.createImageData(width, height);
  image.data.set(raster.pixels);
  context.putImageData(image, 0, 0);
  drawDeltaSource({ ...input, source: canvas });
}

function drawDeltaSource(input: {
  readonly context: CanvasRenderingContext2D;
  readonly projection: GenerationPreviewProjection;
  readonly source: CanvasImageSource;
}): void {
  const { bounds, scale } = input.projection;
  const left = input.projection.offsetX + bounds.minX * scale;
  const top = input.projection.offsetY + bounds.minY * scale;
  input.context.save();
  input.context.imageSmoothingEnabled = false;
  input.context.drawImage(input.source, left, top, bounds.width * scale, bounds.height * scale);
  input.context.restore();
}
