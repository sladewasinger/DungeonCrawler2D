import { BIOME, type BiomeKind } from "@dc2d/engine";
import type Phaser from "phaser";
import {
  depthForCapOccluder,
  depthForOccluder,
} from "../../entities/presentation/depthSort.js";
import type { TerrainScreenProjection } from "../batch/quadBatch.js";
import type {
  TerrainBatches,
  TerrainFloorQuad,
  TerrainSouthFaceQuad,
} from "../geometry/terrainPlannerModel.js";
import { TERRAIN_SURFACES } from "../geometry/terrainPlannerModel.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import { TerrainOverlayLayerPool } from "./pooling/layerPool.js";
import { projectTerrainQuad } from "./projectedTerrainQuad.js";

const TINT_ALPHA = TERRAIN_VISUAL_STYLE.biomeTint.alpha;
const BEDROCK_COLOR = phaserColor(TERRAIN_VISUAL_STYLE.bedrock.topColor);
const BEDROCK_ALPHA = TERRAIN_VISUAL_STYLE.bedrock.topAlpha;
const BIOME_TINTS: Readonly<Record<BiomeKind, number>> = {
  [BIOME.Maze]: tintColor(BIOME.Maze),
  [BIOME.OpenHalls]: tintColor(BIOME.OpenHalls),
  [BIOME.Ruins]: tintColor(BIOME.Ruins),
  [BIOME.Pillars]: tintColor(BIOME.Pillars),
  [BIOME.Pools]: tintColor(BIOME.Pools),
  [BIOME.Arena]: tintColor(BIOME.Arena),
};

type TintQuad = TerrainFloorQuad | TerrainSouthFaceQuad;
type SurfaceTintBiomeAt = (worldTile: { readonly x: number; readonly y: number }) => BiomeKind | null;

export interface SurfaceTintOptions {
  readonly projection: TerrainScreenProjection;
  readonly biomeAt: SurfaceTintBiomeAt;
  readonly biomeEnabled: boolean;
  readonly bedrockEnabled: boolean;
}

export interface SurfaceTintPart {
  readonly quad: TintQuad;
  readonly biome: BiomeKind | null;
  readonly bedrock: boolean;
}

/** Batched color washes keep one shared terrain atlas biome- and surface-aware. */
export class TerrainSurfaceTintRenderer {
  constructor(private readonly layers: TerrainOverlayLayerPool) {}

  render(
    batches: TerrainBatches,
    options: SurfaceTintOptions,
    visible: boolean,
  ): void {
    if (!options.biomeEnabled && !options.bedrockEnabled) {
      return;
    }
    const grouped = groupTintParts(batches, options);
    for (const [depth, parts] of grouped) {
      const graphics = this.layers.acquire("surface", depth, visible);
      drawParts(graphics, parts, options.projection);
    }
  }
}

function tintColor(biome: BiomeKind): number {
  return phaserColor(TERRAIN_VISUAL_STYLE.biomeTint.colors[biome]);
}

function groupTintParts(
  batches: TerrainBatches,
  options: SurfaceTintOptions,
): Map<number, SurfaceTintPart[]> {
  const grouped = new Map<number, SurfaceTintPart[]>();
  for (const quad of batches.floors) appendTintPart(grouped, quad, options);
  for (const quad of batches.southFaces) appendTintPart(grouped, quad, options);
  return grouped;
}

export function groupSurfaceTintParts(
  batches: TerrainBatches,
  options: SurfaceTintOptions,
): ReadonlyMap<number, readonly SurfaceTintPart[]> {
  return groupTintParts(batches, options);
}

function appendTintPart(
  grouped: Map<number, SurfaceTintPart[]>,
  quad: TintQuad,
  options: SurfaceTintOptions,
): void {
  const biome = options.biomeEnabled ? options.biomeAt(quad.worldTile) : null;
  const bedrock = options.bedrockEnabled && quad.kind === "floor" &&
    quad.surface === TERRAIN_SURFACES.Bedrock;
  if (biome === null && !bedrock) return;
  const depth = tintDepth(quad);
  const parts = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, parts);
  parts.push({ quad, biome, bedrock });
}

function tintDepth(quad: TintQuad): number {
  const surface = quad.kind === "floor"
    ? depthForCapOccluder(quad.viewTile.y)
    : depthForOccluder(quad.viewTile.y + 1);
  return surface;
}

function drawParts(
  graphics: Phaser.GameObjects.Graphics,
  parts: readonly SurfaceTintPart[],
  projection: TerrainScreenProjection,
): void {
  for (const part of parts) {
    const points = projectTerrainQuad(part.quad.vertices, projection.project);
    if (part.biome !== null) {
      graphics.fillStyle(BIOME_TINTS[part.biome], TINT_ALPHA);
      fillQuad(graphics, points);
    }
    if (part.bedrock) {
      graphics.fillStyle(BEDROCK_COLOR, BEDROCK_ALPHA);
      fillQuad(graphics, points);
    }
  }
}

function fillQuad(
  graphics: Phaser.GameObjects.Graphics,
  points: ReturnType<typeof projectTerrainQuad>,
): void {
  const [a, b, c, d] = points;
  graphics.beginPath();
  graphics.moveTo(a.x, a.y);
  graphics.lineTo(b.x, b.y);
  graphics.lineTo(c.x, c.y);
  graphics.lineTo(d.x, d.y);
  graphics.closePath();
  graphics.fillPath();
}
