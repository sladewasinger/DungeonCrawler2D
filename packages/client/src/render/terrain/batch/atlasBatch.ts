import type { BiomeKind } from "@dc2d/engine";
import type Phaser from "phaser";
import type { TerrainScreenPoint, TerrainScreenProjection } from "./quadBatch.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";
import { TerrainAOOverlayRenderer } from "../overlay/aoOverlay.js";
import { TerrainCliffHighlightRenderer } from "../overlay/cliffHighlight.js";
import {
  terrainAtlasFrame,
  TERRAIN_TILE_ROLES,
  type TerrainAtlasSet,
  type TerrainTileRole,
} from "../planning/tileset.js";
import { appendMeshQuad, appendSouthFaceDraws, compareDraws, meshKey } from "../geometry/atlasGeometry.js";
import { appendDraws, appendFeatureDraws } from "./atlasDraws.js";

export type TerrainAtlasPhase = 0 | 1 | 2;

/** One texture-backed rectangle submitted by the Terrain planner backend. */
export interface TerrainAtlasDraw { readonly atlas: TerrainAtlasSet; readonly frame: string; readonly role: TerrainTileRole; readonly variant: 0; readonly phase: TerrainAtlasPhase;
  /** Exact row depth shared with entity depth sorting. */
  readonly depth: number;
  /** Optional top-to-bottom crop within the source frame (used by a partial wall tile). */
  readonly uvCrop?: { readonly top: number; readonly bottom: number }; readonly points: readonly [TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint]; }

/** Packed data for one public Phaser 4 Mesh2D texture submission. */
export interface TerrainMeshBatch { readonly atlas: TerrainAtlasSet; readonly phase: TerrainAtlasPhase; readonly depth: number; readonly vertices: number[]; readonly indices: number[]; }

export interface TerrainAtlasRenderOptions { readonly projection: TerrainScreenProjection; readonly biomeAt: (worldTile: { readonly x: number; readonly y: number }) => BiomeKind; readonly debug: boolean; }

/**
 * Creates image draws from pure planner geometry. Floors, void caps, and faces
 * retain their separate painter phases while same-material draws are contiguous.
 */
export function atlasDraws(
  batches: TerrainBatches,
  options: TerrainAtlasRenderOptions,
): readonly TerrainAtlasDraw[] {
  const draws: TerrainAtlasDraw[] = [];
  appendDraws({ target: draws, quads: batches.voids, defaultRole: "void", phase: 0, options });
  appendDraws({ target: draws, quads: batches.floors, defaultRole: "floor", phase: 1, options });
  appendFeatureDraws(draws, batches.features, options);
  appendSouthFaceDraws(draws, batches.southFaces, options);
  return draws.toSorted(compareDraws);
}

/** Registers all stable role/variant crops for a loaded Terrain texture. */
export function installTerrainAtlasFrames(
  textures: Phaser.Textures.TextureManager,
  set: TerrainAtlasSet,
): void {
  const { texture, source } = atlasTexture(textures, set);
  for (const role of TERRAIN_TILE_ROLES) {
    for (let variant = 0; variant < set.rowCount; variant += 1) {
      const frame = terrainAtlasFrame({ set, role, variant, image: source });
      addFrame(texture, frame);
    }
  }
}

function atlasTexture(
  textures: Phaser.Textures.TextureManager,
  set: TerrainAtlasSet,
): { readonly texture: Phaser.Textures.Texture; readonly source: Phaser.Textures.TextureSource; } {
  if (!textures.exists(set.key)) throw new Error(`Terrain atlas is not loaded: ${set.key}`);
  const texture = textures.get(set.key); const source = texture.source[0];
  if (!source) throw new Error(`Terrain atlas has no image source: ${set.key}`);
  return { texture, source };
}

function addFrame(texture: Phaser.Textures.Texture, frame: { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }): void {
  if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}

/** Converts material-grouped atlas draws into Mesh2D's packed vertex format. */
export function terrainMeshBatches(
  draws: readonly TerrainAtlasDraw[],
  imageSize: (atlas: TerrainAtlasSet) => { readonly width: number; readonly height: number },
): readonly TerrainMeshBatch[] {
  const batches = new Map<string, TerrainMeshBatch>();
  for (const draw of draws) {
    const key = `${draw.depth}:${draw.phase}:${draw.atlas.key}`;
    const batch = batches.get(key) ?? { atlas: draw.atlas, phase: draw.phase, depth: draw.depth, vertices: [], indices: [] };
    if (!batches.has(key)) batches.set(key, batch);
    appendMeshQuad(batch, draw, imageSize(draw.atlas));
  }
  return [...batches.values()];
}

/** WebGL-only Phaser 4 Mesh2D backend, one UV-batched mesh per atlas/depth row. */
export class TerrainAtlasBatchRenderer {
  private readonly meshes = new Map<string, Phaser.GameObjects.Mesh2D>();
  private readonly aoOverlay: TerrainAOOverlayRenderer;
  private readonly cliffHighlight: TerrainCliffHighlightRenderer;
  private active = new Set<string>();
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.aoOverlay = new TerrainAOOverlayRenderer(scene);
    this.cliffHighlight = new TerrainCliffHighlightRenderer(scene);
  }

  render(batches: TerrainBatches, options: TerrainAtlasRenderOptions): void {
    const draws = atlasDraws(batches, options);
    this.installDrawAtlases(draws);
    const meshes = terrainMeshBatches(draws, (atlas) => this.scene.textures.get(atlas.key).source[0]!);
    this.syncMeshes(meshes);
    this.aoOverlay.render(batches.ao, options.projection, this.visible);
    this.cliffHighlight.render(batches.cliffEdges, options.projection, this.visible);
  }

  private installDrawAtlases(draws: readonly TerrainAtlasDraw[]): void {
    for (const set of new Set(draws.map((draw) => draw.atlas))) this.installAtlas(set);
  }

  private installAtlas(set: TerrainAtlasSet): void {
    installTerrainAtlasFrames(this.scene.textures, set);
  }

  private syncMeshes(meshes: readonly TerrainMeshBatch[]): void {
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

  private updateMesh(batch: TerrainMeshBatch): void {
    const key = meshKey(batch);
    const mesh = this.meshes.get(key) ?? this.scene.add.mesh2d(0, 0, batch.atlas.key, [], []);
    mesh.vertices = batch.vertices;
    mesh.indices = batch.indices;
    mesh.buildOrderedIndices(2, true);
    mesh.setDepth(batch.depth).setVisible(this.visible);
    this.meshes.set(key, mesh);
  }

}
