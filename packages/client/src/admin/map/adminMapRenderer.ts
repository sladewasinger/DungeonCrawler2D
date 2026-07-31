import type { AdminMap, DebugFlags } from "@dc2d/engine";
import { ADMIN_MAP_TILE_SIZE, type AdminMapCenter } from "./adminMapCamera.js";
import { drawAdminMapCells } from "./adminMapCells.js";
import { drawAdminMapEntities } from "./adminMapEntityRenderer.js";

export interface AdminMapRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap | null;
  readonly center: AdminMapCenter;
  readonly debugFlags: DebugFlags;
}

export function renderAdminMap(input: AdminMapRenderInput): void {
  clearCanvas(input.context);
  const map = input.map;
  if (!map) return drawUnavailable(input.context);
  const mapInput = { ...input, map };
  drawAdminMapCells(mapInput);
  drawAdminMapEntities(mapInput);
  drawCenter(input.context);
}

function clearCanvas(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#090c12";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

function drawUnavailable(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#aeb7c9";
  context.fillText("Authenticate to inspect the map", 20, 30);
}

function drawCenter(context: CanvasRenderingContext2D): void {
  context.strokeStyle = "#f0c36a";
  context.strokeRect(
    context.canvas.width / 2 - ADMIN_MAP_TILE_SIZE / 2,
    context.canvas.height / 2 - ADMIN_MAP_TILE_SIZE / 2,
    ADMIN_MAP_TILE_SIZE,
    ADMIN_MAP_TILE_SIZE,
  );
}
