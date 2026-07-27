import type Phaser from "phaser";
import type { Terrain4Batches, Terrain4QuadVertices, Terrain4Vertex } from "./terrainPlanner.js";

/** A screen-space point submitted to Phaser Graphics. */
export interface Terrain4ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Converts a planner vertex to the screen-space coordinate expected by
 * `Graphics.fillTriangle`. The planner deliberately does not own this camera
 * projection or the height-to-pixel scale.
 */
export interface Terrain4ScreenProjection {
  project(vertex: Terrain4Vertex): Terrain4ScreenPoint;
}

/** Material choice belongs to the backend; planner geometry remains pure. */
export interface Terrain4QuadMaterial {
  readonly color: number;
  readonly alpha?: number;
}

/** One material per pure planner batch. */
export interface Terrain4BatchMaterials {
  readonly floor: Terrain4QuadMaterial;
  readonly feature: Terrain4QuadMaterial;
  readonly void: Terrain4QuadMaterial;
  readonly southFace: Terrain4QuadMaterial;
}

/**
 * Compatibility renderer for Phaser 4.2.1's public Graphics API.
 *
 * Graphics is deliberately used instead of renderer/pipeline internals: it is
 * public, works with Phaser's supported renderers, and already batches adjacent
 * Graphics commands under WebGL. This is a correctness spike, not the final
 * high-volume terrain path; profile a representative chunk before retaining it.
 */
export class Phaser4TerrainQuadBatchRenderer {
  constructor(readonly graphics: Phaser.GameObjects.Graphics) {}

  /** Replaces the previous plan with two public Graphics triangles per quad. */
  render(
    batches: Terrain4Batches,
    projection: Terrain4ScreenProjection,
    materials: Terrain4BatchMaterials,
  ): void {
    this.graphics.clear();
    this.drawBatch(batches.voids, projection, materials.void);
    this.drawBatch(batches.floors, projection, materials.floor);
    this.drawBatch(batches.features, projection, materials.feature);
    this.drawBatch(batches.southFaces, projection, materials.southFace);
  }

  private drawBatch(
    quads: readonly { readonly vertices: Terrain4QuadVertices }[],
    projection: Terrain4ScreenProjection,
    material: Terrain4QuadMaterial,
  ): void {
    if (quads.length === 0) return;
    this.graphics.fillStyle(material.color, material.alpha ?? 1);
    for (const quad of quads) this.drawQuad(quad.vertices, projection);
  }

  private drawQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): void {
    const topLeft = projection.project(vertices[0]);
    const topRight = projection.project(vertices[1]);
    const bottomRight = projection.project(vertices[2]);
    const bottomLeft = projection.project(vertices[3]);
    this.graphics.fillTriangle(topLeft.x, topLeft.y, topRight.x, topRight.y, bottomRight.x, bottomRight.y);
    this.graphics.fillTriangle(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y);
  }
}

/** Creates the single public Graphics object owned by a terrain quad batch. */
export function createPhaser4TerrainQuadBatchRenderer(scene: Phaser.Scene): Phaser4TerrainQuadBatchRenderer {
  return new Phaser4TerrainQuadBatchRenderer(scene.add.graphics());
}
