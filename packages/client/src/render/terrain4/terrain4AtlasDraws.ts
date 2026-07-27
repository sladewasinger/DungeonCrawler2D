import { depthForCapOccluder, depthForOccluder } from "../entities/depthSort.js";
import { projectQuad, terrain4Variant } from "./geometry/terrain4AtlasGeometry.js";
import { TERRAIN4_TILESETS, terrain4AtlasFrameName, type Terrain4TileRole } from "./terrain4Tileset.js";
import type { Terrain4Batches, Terrain4QuadVertices } from "./terrainPlanner.js";
import type { Terrain4AtlasDraw, Terrain4AtlasPhase, Terrain4AtlasRenderOptions } from "./phaser4AtlasBatch.js";

export function appendDraws(input: AppendDrawsInput): void {
  for (const quad of input.quads) appendDraw(input, quad);
}

export interface AppendDrawsInput { readonly target: Terrain4AtlasDraw[]; readonly quads: readonly Terrain4DrawQuad[]; readonly defaultRole: Terrain4TileRole; readonly phase: Terrain4AtlasPhase; readonly options: Terrain4AtlasRenderOptions; }
export interface Terrain4DrawQuad { readonly worldTile: { readonly x: number; readonly y: number }; readonly viewTile: { readonly x: number; readonly y: number }; readonly vertices: Terrain4QuadVertices; readonly kind: string; readonly height?: number; }

function appendDraw(input: AppendDrawsInput, quad: Terrain4DrawQuad): void {
  const role = quad.kind === "floor" && quad.height && quad.height > 0 ? "raised-floor" : input.defaultRole;
  const atlas = input.options.debug ? TERRAIN4_TILESETS.debug : TERRAIN4_TILESETS[input.options.biomeAt(quad.worldTile)];
  const variant = terrain4Variant(quad.worldTile.x, quad.worldTile.y);
  input.target.push({ atlas, frame: terrain4AtlasFrameName(atlas, role, variant), role, variant, phase: input.phase, depth: drawDepth(input.phase, quad.viewTile.y), points: projectQuad(quad.vertices, input.options.projection) });
}

export function appendFeatureDraws(target: Terrain4AtlasDraw[], quads: Terrain4Batches["features"], options: Terrain4AtlasRenderOptions): void {
  for (const quad of quads) appendFeatureDraw(target, quad, options);
}

function appendFeatureDraw(target: Terrain4AtlasDraw[], quad: Terrain4Batches["features"][number], options: Terrain4AtlasRenderOptions): void {
  const atlas = options.debug ? TERRAIN4_TILESETS.debug : TERRAIN4_TILESETS[options.biomeAt(quad.worldTile)];
  const variant = terrain4Variant(quad.worldTile.x, quad.worldTile.y);
  target.push({ atlas, frame: terrain4AtlasFrameName(atlas, quad.feature, variant), role: quad.feature, variant, phase: 1, depth: depthForCapOccluder(quad.viewTile.y), points: projectQuad(quad.vertices, options.projection) });
}

function drawDepth(phase: Terrain4AtlasPhase, viewY: number): number { return phase === 2 ? depthForOccluder(viewY + 1) : depthForCapOccluder(viewY); }
