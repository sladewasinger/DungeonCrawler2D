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
import { pruneTerrainLayers } from "./layerRetention.js";
import { projectTerrainQuad } from "./projectedTerrainQuad.js";

const TINT_DEPTH_BIAS = 0.02;
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
interface TintPart {
  readonly quad: TintQuad;
  readonly biome: BiomeKind | null;
  readonly bedrock: boolean;
}

export interface SurfaceTintOptions {
  readonly projection: TerrainScreenProjection;
  readonly biomeAt: (
    worldTile: { readonly x: number; readonly y: number },
  ) => BiomeKind | null;
  readonly enabled: boolean;
}

/** Batched color washes keep one shared terrain atlas biome- and surface-aware. */
export class TerrainSurfaceTintRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(
    batches: TerrainBatches,
    options: SurfaceTintOptions,
    visible: boolean,
  ): void {
    const grouped = options.enabled ? groupTintParts(batches, options.biomeAt) : new Map();
    pruneTerrainLayers(this.layers, new Set(grouped.keys()));
    for (const [depth, parts] of grouped) {
      const graphics = this.layers.get(depth) ?? this.createLayer(depth);
      graphics.clear().setVisible(visible);
      drawParts(graphics, parts, options.projection);
    }
  }

  setVisible(visible: boolean): void {
    for (const graphics of this.layers.values()) graphics.setVisible(visible);
  }

  destroy(): void {
    for (const graphics of this.layers.values()) graphics.destroy();
    this.layers.clear();
  }

  private createLayer(depth: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setDepth(depth);
    this.layers.set(depth, graphics);
    return graphics;
  }
}

function tintColor(biome: BiomeKind): number {
  return phaserColor(TERRAIN_VISUAL_STYLE.biomeTint.colors[biome]);
}

function groupTintParts(
  batches: TerrainBatches,
  biomeAt: SurfaceTintOptions["biomeAt"],
): Map<number, TintPart[]> {
  const grouped = new Map<number, TintPart[]>();
  for (const quad of batches.floors) appendTintPart(grouped, quad, biomeAt);
  for (const quad of batches.southFaces) appendTintPart(grouped, quad, biomeAt);
  return grouped;
}

function appendTintPart(
  grouped: Map<number, TintPart[]>,
  quad: TintQuad,
  biomeAt: SurfaceTintOptions["biomeAt"],
): void {
  const biome = biomeAt(quad.worldTile);
  const bedrock = quad.kind === "floor" &&
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
  return surface + TINT_DEPTH_BIAS;
}

function drawParts(
  graphics: Phaser.GameObjects.Graphics,
  parts: readonly TintPart[],
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
