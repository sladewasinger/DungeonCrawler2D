import type { AdminMap, BiomeKind } from "@dc2d/engine";
import {
  planTerrain,
  TERRAIN_SURFACES,
  type TerrainFloorQuad,
  type TerrainPlan,
  type TerrainSouthFaceQuad,
} from "../../render/terrain/planning/terrainPlanner.js";
import {
  TERRAIN_TILESETS,
  terrainAtlasFrame,
  type TerrainAtlasFrame,
  type TerrainTileRole,
} from "../../render/terrain/planning/tileset.js";
import { createSpectatorTerrainSource } from "./terrain/liveSpectatorTerrainSource.js";
import {
  terrainFloorRole,
} from "../../render/terrain/material/terrainMaterialRoles.js";
import { drawLiveSpectatorWall } from "./terrain/liveSpectatorWall.js";
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

export function drawLiveSpectatorTerrain(input: LiveSpectatorTerrainInput): void {
  input.context.imageSmoothingEnabled = false;
  const prepared = createSpectatorTerrainSource(input.map);
  const plan = planTerrain(prepared.source, {
    bounds: prepared.bounds,
    orientation: 0,
    seamApron: 0,
  });
  drawPlan(input, plan, prepared.biomeAt);
  drawTerrainVignette(input.context);
}

/** Uses the same finite terrain planner and material classification as gameplay. */
export function planLiveSpectatorTerrain(map: AdminMap): TerrainPlan {
  const prepared = createSpectatorTerrainSource(map);
  return planTerrain(prepared.source, {
    bounds: prepared.bounds,
    orientation: 0,
    seamApron: 0,
  });
}

function drawPlan(input: LiveSpectatorTerrainInput, plan: TerrainPlan, biomeAt: (x: number, y: number) => BiomeKind): void {
  for (const quad of plan.batches.voids) drawVoidQuad(input, quad.viewTile, biomeAt(quad.viewTile.x, quad.viewTile.y));
  for (const quad of plan.batches.floors) drawFloorQuad(input, quad, biomeAt(quad.worldTile.x, quad.worldTile.y));
  for (const quad of plan.batches.features) drawFeatureQuad(input, quad, biomeAt(quad.worldTile.x, quad.worldTile.y));
  for (const quad of plan.batches.southFaces) drawSouthFace(input, quad, biomeAt(quad.worldTile.x, quad.worldTile.y));
  for (const quad of plan.batches.cliffEdges) drawCliffEdge(input, quad.worldTile);
}

function drawVoidQuad(input: LiveSpectatorTerrainInput, tile: { readonly x: number; readonly y: number }, biome: BiomeKind): void {
  const point = liveSpectatorPoint(input.view, tile);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  drawTerrainTile({ ...input, point, role: "void", biome, walkable: false });
}

function drawFloorQuad(input: LiveSpectatorTerrainInput, quad: TerrainFloorQuad, biome: BiomeKind): void {
  const point = liveSpectatorPoint(input.view, quad.worldTile, quad.height);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  const role: TerrainTileRole = terrainFloorRole(quad.surface, cellTerritory(input.map, quad.worldTile.x, quad.worldTile.y));
  drawTerrainTile({ ...input, point, role, biome, walkable: quad.surface === TERRAIN_SURFACES.Floor });
}

function drawFeatureQuad(input: LiveSpectatorTerrainInput, quad: TerrainPlan["batches"]["features"][number], biome: BiomeKind): void {
  const point = liveSpectatorPoint(input.view, quad.worldTile, quad.height);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  drawTerrainTile({ ...input, point, role: quad.feature, biome, walkable: true });
}

function drawSouthFace(input: LiveSpectatorTerrainInput, quad: TerrainSouthFaceQuad, biome: BiomeKind): void {
  drawLiveSpectatorWall({ input, quad, biome });
}

function drawCliffEdge(input: LiveSpectatorTerrainInput, tile: { readonly x: number; readonly y: number }): void {
  const point = liveSpectatorPoint(input.view, tile, input.view.elevation);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize)) return;
  const size = input.view.tileSize;
  input.context.strokeStyle = "rgb(245 248 255 / 88%)";
  input.context.lineWidth = Math.max(1, Math.round(size / 14));
  input.context.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
}

interface TerrainTileDrawInput extends LiveSpectatorTerrainInput {
  readonly point: { readonly x: number; readonly y: number };
  readonly role: TerrainTileRole;
  readonly biome: BiomeKind;
  readonly walkable: boolean;
}

function drawTerrainTile(input: TerrainTileDrawInput): void {
  const { point, role, walkable } = input;
  const size = input.view.tileSize;
  if (terrainReady(input.terrain)) {
    const frame = terrainFrame(input.terrain, role, input.biome);
    input.context.drawImage(input.terrain, frame.x, frame.y, frame.width, frame.height,
      point.x - size / 2, point.y - size / 2, size, size);
    return;
  }
  input.context.fillStyle = fallbackTerrainColor(role, walkable);
  input.context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
}

function terrainFrame(image: HTMLImageElement, role: TerrainTileRole, biome: BiomeKind): TerrainAtlasFrame {
  return terrainAtlasFrame({ set: TERRAIN_TILESETS[biome], role, variant: 0, image });
}

function cellTerritory(map: AdminMap, x: number, y: number): number | null {
  return map.cells.find((cell) => cell.x === x && cell.y === y)?.territory ?? null;
}

function terrainReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function terrainRoleFallback(role: TerrainTileRole): string {
  if (role === "void") return "#080b10";
  if (role === "bedrock" || role === "south-face") return "#4a5360";
  return "#36445a";
}

function fallbackTerrainColor(role: TerrainTileRole, walkable: boolean): string {
  if (role === "floor" && !walkable) return "#4a5360";
  return terrainRoleFallback(role);
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
