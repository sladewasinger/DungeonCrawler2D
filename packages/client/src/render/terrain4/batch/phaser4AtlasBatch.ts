import type { BiomeKind } from "@dc2d/engine";
import type Phaser from "phaser";
import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "./phaser4QuadBatch.js";
import type { Terrain4Batches } from "../planning/terrainPlanner.js";
import { Terrain4AOOverlayRenderer } from "../overlay/terrain4AOOverlay.js";
import { Terrain4CliffHighlightRenderer } from "../overlay/terrain4CliffHighlight.js";
import {
  terrain4AtlasFrame,
  TERRAIN4_TILE_ROLES,
  type Terrain4AtlasSet,
  type Terrain4TileRole,
} from "../planning/terrain4Tileset.js";
import { appendMeshQuad, appendSouthFaceDraws, compareDraws, meshKey } from "../geometry/terrain4AtlasGeometry.js";
import { appendDraws, appendFeatureDraws } from "./terrain4AtlasDraws.js";

export type Terrain4AtlasPhase = 0 | 1 | 2;

/** One texture-backed rectangle submitted by the Terrain4 planner backend. */
export interface Terrain4AtlasDraw { readonly atlas: Terrain4AtlasSet; readonly frame: string; readonly role: Terrain4TileRole; readonly variant: 0; readonly phase: Terrain4AtlasPhase;
  /** Exact row depth shared with entity depth sorting. */
  readonly depth: number;
  /** Optional top-to-bottom crop within the source frame (used by a partial wall tile). */
  readonly uvCrop?: { readonly top: number; readonly bottom: number }; readonly points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint]; }

/** Packed data for one public Phaser 4 Mesh2D texture submission. */
export interface Terrain4MeshBatch { readonly atlas: Terrain4AtlasSet; readonly phase: Terrain4AtlasPhase; readonly depth: number; readonly vertices: number[]; readonly indices: number[]; }

export interface Terrain4AtlasRenderOptions { readonly projection: Terrain4ScreenProjection; readonly biomeAt: (worldTile: { readonly x: number; readonly y: number }) => BiomeKind; readonly debug: boolean; }

/**
 * Creates image draws from pure planner geometry. Floors, void caps, and faces
 * retain their separate painter phases while same-material draws are contiguous.
 */
export function terrain4AtlasDraws(
  batches: Terrain4Batches,
  options: Terrain4AtlasRenderOptions,
): readonly Terrain4AtlasDraw[] {
  const draws: Terrain4AtlasDraw[] = [];
  appendDraws({ target: draws, quads: batches.voids, defaultRole: "void", phase: 0, options });
  appendDraws({ target: draws, quads: batches.floors, defaultRole: "floor", phase: 1, options });
  appendFeatureDraws(draws, batches.features, options);
  appendSouthFaceDraws(draws, batches.southFaces, options);
  return draws.toSorted(compareDraws);
}

/** Registers all stable role/variant crops for a loaded Terrain4 texture. */
export function installTerrain4AtlasFrames(
  textures: Phaser.Textures.TextureManager,
  set: Terrain4AtlasSet,
): void {
  const { texture, source } = atlasTexture(textures, set);
  for (const role of TERRAIN4_TILE_ROLES) {
    for (let variant = 0; variant < set.rowCount; variant += 1) {
      const frame = terrain4AtlasFrame({ set, role, variant, image: source });
      addFrame(texture, frame);
    }
  }
}

function atlasTexture(
  textures: Phaser.Textures.TextureManager,
  set: Terrain4AtlasSet,
): { readonly texture: Phaser.Textures.Texture; readonly source: Phaser.Textures.TextureSource; } {
  if (!textures.exists(set.key)) throw new Error(`Terrain4 atlas is not loaded: ${set.key}`);
  const texture = textures.get(set.key); const source = texture.source[0];
  if (!source) throw new Error(`Terrain4 atlas has no image source: ${set.key}`);
  return { texture, source };
}

function addFrame(texture: Phaser.Textures.Texture, frame: { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }): void {
  if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}

/** Converts material-grouped atlas draws into Mesh2D's packed vertex format. */
export function terrain4MeshBatches(
  draws: readonly Terrain4AtlasDraw[],
  imageSize: (atlas: Terrain4AtlasSet) => { readonly width: number; readonly height: number },
): readonly Terrain4MeshBatch[] {
  const batches = new Map<string, Terrain4MeshBatch>();
  for (const draw of draws) {
    const key = `${draw.depth}:${draw.phase}:${draw.atlas.key}`;
    const batch = batches.get(key) ?? { atlas: draw.atlas, phase: draw.phase, depth: draw.depth, vertices: [], indices: [] };
    if (!batches.has(key)) batches.set(key, batch);
    appendMeshQuad(batch, draw, imageSize(draw.atlas));
  }
  return [...batches.values()];
}

/** WebGL-only Phaser 4 Mesh2D backend, one UV-batched mesh per atlas/depth row. */
export class Phaser4TerrainAtlasBatchRenderer {
  private readonly meshes = new Map<string, Phaser.GameObjects.Mesh2D>();
  private readonly aoOverlay: Terrain4AOOverlayRenderer;
  private readonly cliffHighlight: Terrain4CliffHighlightRenderer;
  private active = new Set<string>();
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.aoOverlay = new Terrain4AOOverlayRenderer(scene);
    this.cliffHighlight = new Terrain4CliffHighlightRenderer(scene);
  }

  render(batches: Terrain4Batches, options: Terrain4AtlasRenderOptions): void {
    const draws = terrain4AtlasDraws(batches, options);
    this.installDrawAtlases(draws);
    const meshes = terrain4MeshBatches(draws, (atlas) => this.scene.textures.get(atlas.key).source[0]!);
    this.syncMeshes(meshes);
    this.aoOverlay.render(batches.ao, options.projection, this.visible);
    this.cliffHighlight.render(batches.cliffEdges, options.projection, this.visible);
  }

  private installDrawAtlases(draws: readonly Terrain4AtlasDraw[]): void {
    for (const set of new Set(draws.map((draw) => draw.atlas))) this.installAtlas(set);
  }

  private installAtlas(set: Terrain4AtlasSet): void {
    installTerrain4AtlasFrames(this.scene.textures, set);
  }

  private syncMeshes(meshes: readonly Terrain4MeshBatch[]): void {
    this.active = new Set(meshes.map(meshKey));
    for (const batch of meshes) this.updateMesh(batch);
    for (const [key, mesh] of this.meshes) mesh.setVisible(this.visible && this.active.has(key));
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const [key, mesh] of this.meshes) mesh.setVisible(visible && this.active.has(key));
    this.aoOverlay.setVisible(visible);
    this.cliffHighlight.setVisible(visible);
  }

  destroy(): void {
    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
    this.aoOverlay.destroy();
    this.cliffHighlight.destroy();
  }

  private updateMesh(batch: Terrain4MeshBatch): void {
    const key = meshKey(batch);
    const mesh = this.meshes.get(key) ?? this.scene.add.mesh2d(0, 0, batch.atlas.key, [], []);
    mesh.vertices = batch.vertices;
    mesh.indices = batch.indices;
    mesh.buildOrderedIndices(2, true);
    mesh.setDepth(batch.depth).setVisible(this.visible);
    this.meshes.set(key, mesh);
  }

}
