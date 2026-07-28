import { depthForCapOccluder, depthForEntity, depthForOccluder } from "../../entities/presentation/depthSort.js";
import { projectQuad } from "../geometry/atlasGeometry.js";
import { TERRAIN_TILESETS, terrainAtlasFrameName, type TerrainTileRole } from "../planning/tileset.js";
import type { TerrainBatches, TerrainQuadVertices } from "../planning/terrainPlanner.js";
import type { TerrainAtlasDraw, TerrainAtlasPhase, TerrainAtlasRenderOptions } from "./atlasBatch.js";

export function appendDraws(input: AppendDrawsInput): void {
  for (const quad of input.quads) appendDraw(input, quad);
}

export interface AppendDrawsInput { readonly target: TerrainAtlasDraw[]; readonly quads: readonly TerrainDrawQuad[]; readonly defaultRole: TerrainTileRole; readonly phase: TerrainAtlasPhase; readonly options: TerrainAtlasRenderOptions; }
export interface TerrainDrawQuad { readonly worldTile: { readonly x: number; readonly y: number }; readonly viewTile: { readonly x: number; readonly y: number }; readonly vertices: TerrainQuadVertices; readonly kind: string; readonly height?: number; }

function appendDraw(input: AppendDrawsInput, quad: TerrainDrawQuad): void {
  const role = input.defaultRole;
  const atlas = input.options.debug ? TERRAIN_TILESETS.debug : TERRAIN_TILESETS[input.options.biomeAt(quad.worldTile)];
  input.target.push({ atlas, frame: terrainAtlasFrameName(atlas, role, 0), role, variant: 0, phase: input.phase, depth: drawDepth(role, input.phase, quad.viewTile.y), points: projectQuad(quad.vertices, input.options.projection) });
}

export function appendFeatureDraws(target: TerrainAtlasDraw[], quads: TerrainBatches["features"], options: TerrainAtlasRenderOptions): void {
  for (const quad of quads) appendFeatureDraw(target, quad, options);
}

function appendFeatureDraw(target: TerrainAtlasDraw[], quad: TerrainBatches["features"][number], options: TerrainAtlasRenderOptions): void {
  const atlas = options.debug ? TERRAIN_TILESETS.debug : TERRAIN_TILESETS[options.biomeAt(quad.worldTile)];
  const depth = quad.wallMounted === true
    ? depthForOccluder(quad.viewTile.y) + 0.1
    : depthForCapOccluder(quad.viewTile.y);
  target.push({ atlas, frame: terrainAtlasFrameName(atlas, quad.feature, 0), role: quad.feature, variant: 0, phase: 1, depth, points: projectQuad(quad.vertices, options.projection) });
}

function drawDepth(role: TerrainTileRole, phase: TerrainAtlasPhase, viewY: number): number {
  if (role === "void") return depthForEntity(viewY - 1) - 0.5;
  return phase === 2 ? depthForOccluder(viewY + 1) : depthForCapOccluder(viewY);
}
