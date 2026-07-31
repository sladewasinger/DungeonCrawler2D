import type { AdminMap } from "@dc2d/engine";
import {
  ADMIN_MAP_TILE_SIZE,
  adminMapScreenPoint,
  pointIsNearCanvas,
  type AdminMapCenter,
} from "./adminMapCamera.js";

export interface AdminMapCellRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
}

export function drawAdminMapCells(input: AdminMapCellRenderInput): void {
  for (const cell of input.map.cells) drawCell(input, cell);
}

function drawCell(
  input: AdminMapCellRenderInput,
  cell: AdminMap["cells"][number],
): void {
  const point = adminMapScreenPoint(cell, input.center, input.context.canvas);
  if (!pointIsNearCanvas(point, input.context.canvas)) return;
  input.context.fillStyle = cell.terrain === "void"
    ? "#0d1018"
    : floorColor(cell.walkable, cell.height);
  input.context.fillRect(point.x, point.y, ADMIN_MAP_TILE_SIZE, ADMIN_MAP_TILE_SIZE);
  input.context.strokeStyle = "#252b38";
  input.context.strokeRect(point.x, point.y, ADMIN_MAP_TILE_SIZE, ADMIN_MAP_TILE_SIZE);
}

function floorColor(walkable: boolean, height: number): string {
  if (!walkable) return "#3b414e";
  const shade = Math.max(0, Math.min(24, Math.round(height * 5)));
  return `rgb(${45 + shade}, ${58 + shade}, ${78 + shade})`;
}
