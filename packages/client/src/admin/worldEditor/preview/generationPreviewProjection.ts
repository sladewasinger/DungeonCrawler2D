import type { FloorBounds, FloorGenerationSnapshot } from "@dc2d/engine";
export { generationPreviewCellDescription } from "./generationPreviewHover.js";
import { drawGenerationPreviewCursor, drawGenerationPreviewDecorations } from "./generationPreviewDrawing.js";
import { drawGenerationPreviewRaster } from "./raster/generationPreviewRaster.js";
import { drawGenerationPreviewDeltaRaster } from "./raster/generationPreviewDeltaRaster.js";

export interface GenerationPreviewCanvas {
  readonly width: number;
  readonly height: number;
  readonly clientWidth?: number;
  readonly clientHeight?: number;
  readonly clientLeft?: number;
  readonly clientTop?: number;
}

export interface GenerationPreviewProjection {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly bounds: FloorBounds;
}

export interface GenerationPreviewCanvasRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface GenerationPreviewCanvasPointInput {
  readonly canvas: GenerationPreviewCanvas;
  readonly rect: GenerationPreviewCanvasRect;
  readonly clientX: number;
  readonly clientY: number;
}

export interface GenerationPreviewClientCellInput extends GenerationPreviewCanvasPointInput {
  readonly projection: GenerationPreviewProjection;
}

export interface GenerationPreviewDrawInput {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: FloorGenerationSnapshot;
  readonly projection: GenerationPreviewProjection;
  readonly cursor?: { readonly x: number; readonly y: number } | null;
  readonly showRoutes?: boolean;
  readonly deltaMask?: Uint8Array;
}

export function fitGenerationPreview(
  bounds: FloorBounds,
  canvas: GenerationPreviewCanvas,
  padding = 10,
): GenerationPreviewProjection {
  const availableWidth = Math.max(1, canvas.width - padding * 2);
  const availableHeight = Math.max(1, canvas.height - padding * 2);
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  const mapWidth = bounds.width * scale;
  const mapHeight = bounds.height * scale;
  return {
    scale,
    offsetX: (canvas.width - mapWidth) / 2 - bounds.minX * scale,
    offsetY: (canvas.height - mapHeight) / 2 - bounds.minY * scale,
    bounds,
  };
}

export function generationPreviewScreenPoint(
  projection: GenerationPreviewProjection,
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  return {
    x: projection.offsetX + x * projection.scale,
    y: projection.offsetY + y * projection.scale,
  };
}

export function generationPreviewCellAt(
  projection: GenerationPreviewProjection,
  screenX: number,
  screenY: number,
): { readonly x: number; readonly y: number } | null {
  const x = Math.floor((screenX - projection.offsetX) / projection.scale);
  const y = Math.floor((screenY - projection.offsetY) / projection.scale);
  return x >= projection.bounds.minX && x <= projection.bounds.maxX
    && y >= projection.bounds.minY && y <= projection.bounds.maxY ? { x, y } : null;
}

export function generationPreviewCanvasPoint(
  input: GenerationPreviewCanvasPointInput,
): { readonly x: number; readonly y: number } {
  const width = Math.max(1, positiveSize(input.canvas.clientWidth, input.rect.width));
  const height = Math.max(1, positiveSize(input.canvas.clientHeight, input.rect.height));
  return {
    x: (input.clientX - input.rect.left - (input.canvas.clientLeft ?? 0)) * input.canvas.width / width,
    y: (input.clientY - input.rect.top - (input.canvas.clientTop ?? 0)) * input.canvas.height / height,
  };
}

export function generationPreviewCellFromClient(
  input: GenerationPreviewClientCellInput,
): { readonly x: number; readonly y: number } | null {
  const point = generationPreviewCanvasPoint(input);
  return generationPreviewCellAt(input.projection, point.x, point.y);
}

function positiveSize(value: number | undefined, fallback: number): number {
  return value && value > 0 ? value : fallback;
}

export function drawGenerationPreview(input: GenerationPreviewDrawInput): void {
  const { context, snapshot, projection } = input;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.fillStyle = "#080c12";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  drawGenerationPreviewRaster({ context, snapshot, projection });
  if (input.deltaMask) drawGenerationPreviewDeltaRaster({ context, projection, mask: input.deltaMask });
  drawGenerationPreviewDecorations({
    context, snapshot, projection,
    screenPoint: generationPreviewScreenPoint,
    showRoutes: input.showRoutes ?? false,
  });
  drawGenerationPreviewCursor({
    context,
    projection,
    ...(input.cursor === undefined ? {} : { cell: input.cursor }),
    screenPoint: generationPreviewScreenPoint,
  });
}
