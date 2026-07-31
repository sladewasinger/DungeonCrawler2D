import type { AdminMap } from "@dc2d/engine";
import {
  adminMapScreenPoint,
  pointIsNearCanvas,
  type AdminMapCenter,
} from "./adminMapCamera.js";

export interface AdminMapCellRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
  readonly tileSize: number;
}

export function drawAdminMapCells(input: AdminMapCellRenderInput): void {
  for (const cell of input.map.cells) drawCell(input, cell);
}

function drawCell(
  input: AdminMapCellRenderInput,
  cell: AdminMap["cells"][number],
): void {
  const { tileSize } = input;
  const point = adminMapScreenPoint({
    world: cell,
    center: input.center,
    canvas: input.context.canvas,
    tileSize,
  });
  if (!pointIsNearCanvas(point, input.context.canvas, tileSize)) return;
  input.context.fillStyle = cell.terrain === "void"
    ? "#0d1018"
    : floorColor(cell.walkable, cell.height);
  input.context.fillRect(point.x, point.y, tileSize, tileSize);
  input.context.strokeStyle = "#252b38";
  input.context.strokeRect(point.x, point.y, tileSize, tileSize);
}

function floorColor(walkable: boolean, height: number): string {
  if (!walkable) return "#3b414e";
  const shade = Math.max(0, Math.min(24, Math.round(height * 5)));
  return `rgb(${45 + shade}, ${58 + shade}, ${78 + shade})`;
}
