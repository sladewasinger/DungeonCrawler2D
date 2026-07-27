import type { BiomeKind } from "@dc2d/engine";
import type Phaser from "phaser";
import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "./phaser4QuadBatch.js";
import type { Terrain4Batches, Terrain4QuadVertices } from "./terrainPlanner.js";
import {
  TERRAIN4_TILESETS,
  terrain4AtlasFrame,
  terrain4AtlasFrameName,
  type Terrain4AtlasSet,
  type Terrain4TileRole,
} from "./terrain4Tileset.js";

type Terrain4AtlasPhase = 0 | 1 | 2;

/** One texture-backed rectangle submitted by the Terrain4 planner backend. */
export interface Terrain4AtlasDraw {
  readonly atlas: Terrain4AtlasSet;
  readonly frame: string;
  readonly role: Terrain4TileRole;
  readonly variant: 0 | 1;
  readonly phase: Terrain4AtlasPhase;
  readonly points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint];
}

/** Packed data for one public Phaser 4 Mesh2D texture submission. */
export interface Terrain4MeshBatch {
  readonly atlas: Terrain4AtlasSet;
  readonly phase: Terrain4AtlasPhase;
  readonly vertices: number[];
  readonly indices: number[];
}

export interface Terrain4AtlasRenderOptions {
  readonly projection: Terrain4ScreenProjection;
  readonly biomeAt: (worldTile: { readonly x: number; readonly y: number }) => BiomeKind;
  readonly debug: boolean;
}

/**
 * Creates image draws from pure planner geometry. Floors, void caps, and faces
 * retain their separate painter phases while same-material draws are contiguous.
 */
export function terrain4AtlasDraws(
  batches: Terrain4Batches,
  options: Terrain4AtlasRenderOptions,
): readonly Terrain4AtlasDraw[] {
  const draws: Terrain4AtlasDraw[] = [];
  appendDraws(draws, batches.voids, "void", 0, options);
  appendDraws(draws, batches.floors, "floor", 1, options);
  appendDraws(draws, batches.southFaces, "south-face", 2, options);
  return draws.toSorted(compareDraws);
}

/** Registers all stable role/variant crops for a loaded Terrain4 texture. */
export function installTerrain4AtlasFrames(
  textures: Phaser.Textures.TextureManager,
  set: Terrain4AtlasSet,
): void {
  if (!textures.exists(set.key)) throw new Error(`Terrain4 atlas is not loaded: ${set.key}`);
  const texture = textures.get(set.key);
  const source = texture.source[0];
  if (!source) throw new Error(`Terrain4 atlas has no image source: ${set.key}`);
  for (const role of ["floor", "raised-floor", "south-face", "corner-face", "void", "stairs", "door", "brazier"] as const) {
    for (const variant of [0, 1]) {
      const frame = terrain4AtlasFrame(set, role, variant, source.width, source.height);
      if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
    }
  }
}

/** Converts material-grouped atlas draws into Mesh2D's packed vertex format. */
export function terrain4MeshBatches(
  draws: readonly Terrain4AtlasDraw[],
  imageSize: (atlas: Terrain4AtlasSet) => { readonly width: number; readonly height: number },
): readonly Terrain4MeshBatch[] {
  const batches = new Map<string, Terrain4MeshBatch>();
  for (const draw of draws) {
    const key = `${draw.phase}:${draw.atlas.key}`;
    const batch = batches.get(key) ?? { atlas: draw.atlas, phase: draw.phase, vertices: [], indices: [] };
    if (!batches.has(key)) batches.set(key, batch);
    appendMeshQuad(batch, draw, imageSize(draw.atlas));
  }
  return [...batches.values()];
}

/** WebGL-only Phaser 4 Mesh2D backend, one UV-batched mesh per atlas/material phase. */
export class Phaser4TerrainAtlasBatchRenderer {
  private readonly meshes = new Map<string, Phaser.GameObjects.Mesh2D>();
  private active = new Set<string>();
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {}

  render(batches: Terrain4Batches, options: Terrain4AtlasRenderOptions): void {
    const draws = terrain4AtlasDraws(batches, options);
    for (const set of new Set(draws.map((draw) => draw.atlas))) installTerrain4AtlasFrames(this.scene.textures, set);
    const meshes = terrain4MeshBatches(draws, (atlas) => textureSize(this.scene.textures, atlas));
    this.active = new Set(meshes.map(meshKey));
    for (const batch of meshes) this.updateMesh(batch);
    for (const [key, mesh] of this.meshes) mesh.setVisible(this.visible && this.active.has(key));
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const [key, mesh] of this.meshes) mesh.setVisible(visible && this.active.has(key));
  }

  destroy(): void {
    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
  }

  private updateMesh(batch: Terrain4MeshBatch): void {
    const key = meshKey(batch);
    const mesh = this.meshes.get(key) ?? this.scene.add.mesh2d(0, 0, batch.atlas.key, [], []);
    mesh.vertices = batch.vertices;
    mesh.indices = batch.indices;
    mesh.buildOrderedIndices(2, true);
    mesh.setDepth(this.depth + batch.phase).setVisible(this.visible);
    this.meshes.set(key, mesh);
  }
}

function appendDraws(
  target: Terrain4AtlasDraw[],
  quads: readonly { readonly worldTile: { readonly x: number; readonly y: number }; readonly vertices: Terrain4QuadVertices; readonly kind: string; readonly height?: number }[],
  defaultRole: Terrain4TileRole,
  phase: Terrain4AtlasPhase,
  options: Terrain4AtlasRenderOptions,
): void {
  for (const quad of quads) {
    const role = quad.kind === "floor" && quad.height && quad.height > 0 ? "raised-floor" : defaultRole;
    const atlas = options.debug ? TERRAIN4_TILESETS.debug : TERRAIN4_TILESETS[options.biomeAt(quad.worldTile)];
    const variant = terrain4Variant(quad.worldTile.x, quad.worldTile.y);
    target.push({ atlas, frame: terrain4AtlasFrameName(atlas, role, variant), role, variant, phase, points: projectQuad(quad.vertices, options.projection) });
  }
}

function appendMeshQuad(batch: Terrain4MeshBatch, draw: Terrain4AtlasDraw, image: { readonly width: number; readonly height: number }): void {
  const frame = terrain4AtlasFrame(draw.atlas, draw.role, draw.variant, image.width, image.height);
  const base = batch.vertices.length / 4;
  const u0 = frame.x / image.width;
  const v0 = frame.y / image.height;
  const u1 = (frame.x + frame.width) / image.width;
  const v1 = (frame.y + frame.height) / image.height;
  const [topLeft, topRight, bottomRight, bottomLeft] = draw.points;
  batch.vertices.push(
    topLeft.x, topLeft.y, u0, v0,
    topRight.x, topRight.y, u1, v0,
    bottomRight.x, bottomRight.y, u1, v1,
    bottomLeft.x, bottomLeft.y, u0, v1,
  );
  batch.indices.push(base, base + 1, base + 2, 0, base, base + 2, base + 3, 0);
}

function projectQuad(
  vertices: Terrain4QuadVertices,
  projection: Terrain4ScreenProjection,
): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function terrain4Variant(x: number, y: number): 0 | 1 {
  return Math.abs(x * 31 + y * 17) % 2 as 0 | 1;
}

function compareDraws(left: Terrain4AtlasDraw, right: Terrain4AtlasDraw): number {
  return left.phase - right.phase || left.atlas.key.localeCompare(right.atlas.key);
}

function meshKey(batch: Pick<Terrain4MeshBatch, "atlas" | "phase">): string {
  return `${batch.phase}:${batch.atlas.key}`;
}

function textureSize(textures: Phaser.Textures.TextureManager, atlas: Terrain4AtlasSet): { width: number; height: number } {
  const source = textures.get(atlas.key).source[0];
  if (!source) throw new Error(`Terrain4 atlas has no image source: ${atlas.key}`);
  return source;
}
