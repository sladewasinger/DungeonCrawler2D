import type { AdminMap, DebugFlags } from "@dc2d/engine";
import type { AdminMapCenter } from "./adminMapCamera.js";
import { drawAdminMapCells } from "./adminMapCells.js";
import { drawAdminMapEntities } from "./adminMapEntityRenderer.js";

export interface AdminMapRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap | null;
  readonly center: AdminMapCenter;
  readonly tileSize: number;
  readonly debugFlags: DebugFlags;
  readonly unavailableMessage: string;
}

export function renderAdminMap(input: AdminMapRenderInput): void {
  clearCanvas(input.context);
  const map = input.map;
  if (!map) return drawUnavailable(input.context, input.unavailableMessage);
  const mapInput = { ...input, map };
  drawAdminMapCells(mapInput);
  drawAdminMapEntities(mapInput);
  drawCenter(input.context, input.tileSize);
}

function clearCanvas(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#090c12";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

function drawUnavailable(context: CanvasRenderingContext2D, message: string): void {
  context.fillStyle = "#aeb7c9";
  context.fillText(message, 20, 30);
}

function drawCenter(context: CanvasRenderingContext2D, tileSize: number): void {
  context.strokeStyle = "#f0c36a";
  context.strokeRect(
    context.canvas.width / 2 - tileSize / 2,
    context.canvas.height / 2 - tileSize / 2,
    tileSize,
    tileSize,
  );
}
