import type Phaser from "phaser";
import type { TerrainBatches, TerrainQuadVertices, TerrainVertex } from "../planning/terrainPlanner.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";

const DEFAULT_AO_MATERIAL = {
  color: phaserColor(TERRAIN_VISUAL_STYLE.ambientOcclusion.color),
  alpha: TERRAIN_VISUAL_STYLE.ambientOcclusion.fallbackAlpha,
};

/** A screen-space point submitted to Phaser Graphics. */
export interface TerrainScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Converts a planner vertex to the screen-space coordinate expected by
 * `Graphics.fillTriangle`. The planner deliberately does not own this camera
 * projection or the height-to-pixel scale.
 */
export interface TerrainScreenProjection {
  project(vertex: TerrainVertex): TerrainScreenPoint;
}

/** Material choice belongs to the backend; planner geometry remains pure. */
export interface TerrainQuadMaterial {
  readonly color: number;
  readonly alpha?: number;
}

/** One material per pure planner batch. */
export interface TerrainBatchMaterials {
  readonly floor: TerrainQuadMaterial;
  readonly feature: TerrainQuadMaterial;
  readonly void: TerrainQuadMaterial;
  readonly southFace: TerrainQuadMaterial;
  readonly cliffEdge?: TerrainQuadMaterial;
  readonly ao?: TerrainQuadMaterial;
}

/**
 * Compatibility renderer for Phaser 4.2.1's public Graphics API.
 *
 * Graphics is deliberately used instead of renderer/pipeline internals: it is
 * public, works with Phaser's supported renderers, and already batches adjacent
 * Graphics commands under WebGL. This is a correctness spike, not the final
 * high-volume terrain path; profile a representative chunk before retaining it.
 */
export class TerrainQuadBatchRenderer {
  constructor(readonly graphics: Phaser.GameObjects.Graphics) {}

  /** Replaces the previous plan with two public Graphics triangles per quad. */
  render(
    batches: TerrainBatches,
    projection: TerrainScreenProjection,
    materials: TerrainBatchMaterials,
  ): void {
    this.graphics.clear();
    this.drawBatch(batches.voids, projection, materials.void);
    this.drawBatch(batches.floors, projection, materials.floor);
    this.drawBatch(batches.features, projection, materials.feature);
    this.drawBatch(batches.props, projection, materials.feature);
    this.drawBatch(batches.southFaces, projection, materials.southFace);
    this.drawBatch(batches.cliffEdges, projection, materials.cliffEdge ?? materials.southFace);
    this.drawBatch(batches.ao, projection, materials.ao ?? DEFAULT_AO_MATERIAL);
  }

  private drawBatch(
    quads: readonly { readonly vertices: TerrainQuadVertices }[],
    projection: TerrainScreenProjection,
    material: TerrainQuadMaterial,
  ): void {
    if (quads.length === 0) return;
    this.graphics.fillStyle(material.color, material.alpha ?? 1);
    for (const quad of quads) this.drawQuad(quad.vertices, projection);
  }

  private drawQuad(vertices: TerrainQuadVertices, projection: TerrainScreenProjection): void {
    const topLeft = projection.project(vertices[0]);
    const topRight = projection.project(vertices[1]);
    const bottomRight = projection.project(vertices[2]);
    const bottomLeft = projection.project(vertices[3]);
    this.graphics.fillTriangle(topLeft.x, topLeft.y, topRight.x, topRight.y, bottomRight.x, bottomRight.y);
    this.graphics.fillTriangle(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y);
  }
}

/** Creates the single public Graphics object owned by a terrain quad batch. */
export function createTerrainQuadBatchRenderer(scene: Phaser.Scene): TerrainQuadBatchRenderer {
  return new TerrainQuadBatchRenderer(scene.add.graphics());
}
