import { BIOME, type AdminMap, type AdminMapCell } from "@dc2d/engine";
import {
  TERRAIN_TILESETS,
  terrainAtlasFrame,
  type TerrainAtlasFrame,
  type TerrainTileRole,
} from "../../render/terrain/planning/tileset.js";
import {
  liveSpectatorPoint,
  liveSpectatorPointIsVisible,
  type LiveSpectatorView,
} from "./liveSpectatorView.js";

export interface LiveSpectatorTerrainInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly terrain: HTMLImageElement;
  readonly view: LiveSpectatorView;
}

type TerrainRole = Extract<TerrainTileRole, "floor" | "raised-floor" | "south-face" | "void">;

export function drawLiveSpectatorTerrain(input: LiveSpectatorTerrainInput): void {
  input.context.imageSmoothingEnabled = false;
  drawTerrainCaps(input);
  drawTerrainFaces(input);
  drawTerrainVignette(input.context);
}

function drawTerrainCaps(input: LiveSpectatorTerrainInput): void {
  const cells = [...input.map.cells].sort(compareTerrainCells);
  for (const cell of cells) drawTerrainCap(input, cell);
}

function drawTerrainCap(input: LiveSpectatorTerrainInput, cell: AdminMapCell): void {
  const point = liveSpectatorPoint(input.view, cell, cell.height);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  const role = terrainRole(cell);
  drawTerrainFrame({ ...input, cell, point, role });
  drawUnloadedTerrain({ ...input, cell, point, role });
}

function drawTerrainFaces(input: LiveSpectatorTerrainInput): void {
  for (const cell of input.map.cells) drawSouthFace(input, cell);
}

function drawSouthFace(input: LiveSpectatorTerrainInput, cell: AdminMapCell): void {
  const drop = southDrop(cell, input.map.cells);
  if (drop <= 0 || cell.terrain === "void") return;
  const point = liveSpectatorPoint(input.view, cell, cell.height);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  drawTerrainFace(input, point, drop);
}

function drawTerrainFace(
  input: LiveSpectatorTerrainInput,
  point: { readonly x: number; readonly y: number },
  drop: number,
): void {
  const size = input.view.tileSize;
  const height = Math.min(size * 3, drop * size);
  const x = point.x - size / 2;
  const y = point.y + size / 2;
  if (terrainReady(input.terrain)) {
    const frame = terrainFrame(input.terrain, "south-face");
    input.context.drawImage(input.terrain, frame.x, frame.y, frame.width, frame.height, x, y, size, height);
    return;
  }
  input.context.fillStyle = "#243043";
  input.context.fillRect(x, y, size, height);
}

function drawTerrainFrame(input: LiveSpectatorTerrainInput & {
  readonly cell: AdminMapCell;
  readonly point: { readonly x: number; readonly y: number };
  readonly role: TerrainRole;
}): void {
  if (!terrainReady(input.terrain)) return;
  const frame = terrainFrame(input.terrain, input.role);
  const size = input.view.tileSize;
  input.context.drawImage(
    input.terrain,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    input.point.x - size / 2,
    input.point.y - size / 2,
    size,
    size,
  );
}

function drawUnloadedTerrain(input: LiveSpectatorTerrainInput & {
  readonly cell: AdminMapCell;
  readonly point: { readonly x: number; readonly y: number };
  readonly role: TerrainRole;
}): void {
  if (terrainReady(input.terrain)) return;
  const size = input.view.tileSize;
  input.context.fillStyle = fallbackTerrainColor(input.role, input.cell.walkable);
  input.context.fillRect(input.point.x - size / 2, input.point.y - size / 2, size, size);
  input.context.strokeStyle = "rgb(21 27 38 / 72%)";
  input.context.strokeRect(input.point.x - size / 2, input.point.y - size / 2, size, size);
}

function terrainRole(cell: AdminMapCell): TerrainRole {
  if (cell.terrain === "void") return "void";
  return cell.walkable && cell.height <= 0 ? "floor" : "raised-floor";
}

function terrainFrame(image: HTMLImageElement, role: TerrainRole): TerrainAtlasFrame {
  return terrainAtlasFrame({ set: TERRAIN_TILESETS[BIOME.Maze], role, variant: 0, image });
}

function terrainReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function compareTerrainCells(left: AdminMapCell, right: AdminMapCell): number {
  return left.y - right.y || left.x - right.x || left.height - right.height;
}

function southDrop(cell: AdminMapCell, cells: readonly AdminMapCell[]): number {
  const south = cells.find((candidate) => candidate.x === cell.x && candidate.y === cell.y + 1);
  return Math.max(0, cell.height - (south?.height ?? cell.height - 1));
}

function fallbackTerrainColor(role: TerrainRole, walkable: boolean): string {
  if (role === "void") return "#080b10";
  if (role === "raised-floor") return "#5a6473";
  return walkable ? "#36445a" : "#4a5360";
}

function drawTerrainVignette(context: CanvasRenderingContext2D): void {
  const gradient = context.createRadialGradient(
    context.canvas.width / 2,
    context.canvas.height / 2,
    context.canvas.width * 0.16,
    context.canvas.width / 2,
    context.canvas.height / 2,
    context.canvas.width * 0.72,
  );
  gradient.addColorStop(0, "rgb(0 0 0 / 0%)");
  gradient.addColorStop(1, "rgb(0 0 0 / 35%)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}
