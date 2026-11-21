import type { FloorGenerationSnapshot } from "@dc2d/engine";
import { previewCellChannels } from "../generationPreviewColors.js";
import type { GenerationPreviewProjection } from "../generationPreviewProjection.js";

export interface GenerationPreviewRaster {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

interface RasterCache {
  readonly snapshot: FloorGenerationSnapshot;
  readonly source: CanvasImageSource;
}

let currentRaster: RasterCache | null = null;

export function createGenerationPreviewRaster(
  snapshot: FloorGenerationSnapshot,
): GenerationPreviewRaster {
  const { width, height } = snapshot.bounds;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels.set(previewCellChannels({
      semantic: snapshot.semantic[index] ?? 0,
      height: snapshot.height[index] ?? 0,
      region: snapshot.region[index] ?? 0,
      featureId: snapshot.featureIds[index] ?? -1,
    }), index * 4);
  }
  return { width, height, pixels };
}

export function drawGenerationPreviewRaster(input: {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: FloorGenerationSnapshot;
  readonly projection: GenerationPreviewProjection;
}): void {
  const source = rasterSource(input.context, input.snapshot);
  if (!source || typeof input.context.drawImage !== "function") return;
  const { bounds, scale } = input.projection;
  const left = input.projection.offsetX + bounds.minX * scale;
  const top = input.projection.offsetY + bounds.minY * scale;
  input.context.save();
  input.context.imageSmoothingEnabled = false;
  input.context.drawImage(source, left, top, bounds.width * scale, bounds.height * scale);
  input.context.restore();
}

function rasterSource(
  context: CanvasRenderingContext2D,
  snapshot: FloorGenerationSnapshot,
): CanvasImageSource | null {
  if (currentRaster?.snapshot === snapshot) return currentRaster.source;
  const ownerDocument = context.canvas.ownerDocument ?? globalThis.document;
  if (!ownerDocument) return null;
  const canvas = ownerDocument.createElement("canvas");
  canvas.width = snapshot.bounds.width;
  canvas.height = snapshot.bounds.height;
  const rasterContext = canvas.getContext("2d");
  if (!rasterContext) return null;
  const raster = createGenerationPreviewRaster(snapshot);
  const image = rasterContext.createImageData(raster.width, raster.height);
  image.data.set(raster.pixels);
  rasterContext.putImageData(image, 0, 0);
  currentRaster = { snapshot, source: canvas };
  return canvas;
}
