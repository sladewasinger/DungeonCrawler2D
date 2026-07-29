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
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import { pruneTerrainLayers } from "./layerRetention.js";
import { projectTerrainQuad } from "./projectedTerrainQuad.js";

const TINT_DEPTH_BIAS = 0.02;
const TINT_ALPHA = TERRAIN_VISUAL_STYLE.biomeTint.alpha;
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
  readonly biome: BiomeKind;
}

export interface BiomeTintOptions {
  readonly projection: TerrainScreenProjection;
  readonly biomeAt: (
    worldTile: { readonly x: number; readonly y: number },
  ) => BiomeKind | null;
  readonly enabled: boolean;
}

/** A translucent batched color wash keeps one shared terrain atlas biome-aware. */
export class TerrainBiomeTintRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(
    batches: TerrainBatches,
    options: BiomeTintOptions,
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
  biomeAt: BiomeTintOptions["biomeAt"],
): Map<number, TintPart[]> {
  const grouped = new Map<number, TintPart[]>();
  for (const quad of batches.floors) appendTintPart(grouped, quad, biomeAt);
  for (const quad of batches.southFaces) appendTintPart(grouped, quad, biomeAt);
  return grouped;
}

function appendTintPart(
  grouped: Map<number, TintPart[]>,
  quad: TintQuad,
  biomeAt: BiomeTintOptions["biomeAt"],
): void {
  const biome = biomeAt(quad.worldTile);
  if (biome === null) return;
  const depth = tintDepth(quad);
  const parts = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, parts);
  parts.push({ quad, biome });
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
  for (const { quad, biome } of parts) {
    graphics.fillStyle(BIOME_TINTS[biome], TINT_ALPHA);
    fillQuad(graphics, projectTerrainQuad(quad.vertices, projection.project));
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
