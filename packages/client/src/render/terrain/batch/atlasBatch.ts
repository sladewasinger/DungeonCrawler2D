import type { BiomeKind } from "@dc2d/engine";
import type Phaser from "phaser";
import type { TerrainScreenPoint, TerrainScreenProjection } from "./quadBatch.js";
import type { TerrainBatches } from "../planning/terrainPlanner.js";
import { TerrainAOOverlayRenderer } from "../overlay/aoOverlay.js";
import { TerrainCliffHighlightRenderer } from "../overlay/cliffHighlight.js";
import { TerrainSurfaceTintRenderer } from "../overlay/surfaceTint.js";
import type { TerrainAtlasSet, TerrainTileRole } from "../planning/tileset.js";
import { installTerrainAtlasFrames } from "./atlasFrames.js";
export { installTerrainAtlasFrames } from "./atlasFrames.js";
import { appendMeshQuad, appendSouthFaceDraws, compareDraws, meshKey } from "../geometry/atlasGeometry.js";
import { appendDraws, appendFeatureDraws } from "./atlasDraws.js";
import { materialDebugSamples, type TerrainMaterialDebugSample } from "./atlasDebug.js";
import { pruneTerrainMeshes } from "./meshRetention.js";
import type { TerrainVisualFeatures } from "../streaming/terrainDeviceProfile.js";
import { TerrainOverlayLayerPool } from "../overlay/pooling/layerPool.js";

export type TerrainAtlasPhase = 0 | 1 | 2;

export interface TerrainAtlasDraw { readonly atlas: TerrainAtlasSet; readonly frame: string; readonly role: TerrainTileRole; readonly variant: 0; readonly worldTile?: { readonly x: number; readonly y: number }; readonly phase: TerrainAtlasPhase;
  readonly depth: number;
  readonly uvCrop?: { readonly top: number; readonly bottom: number }; readonly points: readonly [TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint]; }

export interface TerrainMeshBatch { readonly atlas: TerrainAtlasSet; readonly role: TerrainTileRole; readonly phase: TerrainAtlasPhase; readonly depth: number; readonly vertices: number[]; readonly indices: number[]; }

export interface TerrainAtlasRenderDebugState {
  readonly activeMeshKeys: readonly string[];
  readonly retainedMeshKeys: readonly string[];
  readonly overlayLayerKeys: readonly string[];
  readonly meshVertexCounts: Readonly<Record<string, number>>;
  readonly materialSamples: readonly TerrainMaterialDebugSample[];
}

export interface TerrainAtlasRenderOptions { readonly projection: TerrainScreenProjection; readonly biomeAt: (worldTile: { readonly x: number; readonly y: number }) => BiomeKind; readonly territoryAt?: (worldTile: { readonly x: number; readonly y: number }) => number | null; readonly biomeTintAt?: (worldTile: { readonly x: number; readonly y: number }) => BiomeKind | null; readonly debug: boolean; }

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

export function terrainMeshBatches(
  draws: readonly TerrainAtlasDraw[],
  imageSize: (atlas: TerrainAtlasSet) => { readonly width: number; readonly height: number },
): readonly TerrainMeshBatch[] {
  const batches = new Map<string, TerrainMeshBatch>();
  for (const draw of draws) {
    const key = `${draw.depth}:${draw.phase}:${draw.atlas.key}:${draw.role}`;
    const batch = batches.get(key) ?? { atlas: draw.atlas, role: draw.role, phase: draw.phase, depth: draw.depth, vertices: [], indices: [] };
    if (!batches.has(key)) batches.set(key, batch);
    appendMeshQuad(batch, draw, imageSize(draw.atlas));
  }
  return [...batches.values()];
}

export class TerrainAtlasBatchRenderer {
  private readonly meshes = new Map<string, Phaser.GameObjects.Mesh2D>();
  private readonly aoOverlay: TerrainAOOverlayRenderer;
  private readonly cliffHighlight: TerrainCliffHighlightRenderer;
  private readonly surfaceTint: TerrainSurfaceTintRenderer;
  private readonly overlayLayers: TerrainOverlayLayerPool;
  private active = new Set<string>();
  private visible = false;
  private materialSamples: readonly TerrainMaterialDebugSample[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly visualFeatures: TerrainVisualFeatures,
  ) {
    this.overlayLayers = new TerrainOverlayLayerPool(scene);
    this.aoOverlay = new TerrainAOOverlayRenderer(this.overlayLayers);
    this.cliffHighlight = new TerrainCliffHighlightRenderer(this.overlayLayers);
    this.surfaceTint = new TerrainSurfaceTintRenderer(this.overlayLayers);
  }

  render(batches: TerrainBatches, options: TerrainAtlasRenderOptions): void {
    const draws = atlasDraws(batches, options);
    for (const set of new Set(draws.map((draw) => draw.atlas))) {
      installTerrainAtlasFrames(this.scene.textures, set);
    }
    const meshes = terrainMeshBatches(draws, (atlas) => this.scene.textures.get(atlas.key).source[0]!);
    this.syncMeshes(meshes);
    this.materialSamples = materialDebugSamples(draws, (atlas) => this.scene.textures.get(atlas.key).source[0]!);
    this.renderOverlays(batches, options);
  }

  debugState(): TerrainAtlasRenderDebugState {
    return {
      activeMeshKeys: [...this.active].sort(),
      retainedMeshKeys: [...this.meshes.keys()].sort(),
      overlayLayerKeys: this.overlayLayers.activeKeys(),
      meshVertexCounts: Object.fromEntries(
        [...this.meshes.entries()].map(([key, mesh]) => [key, mesh.vertices.length]),
      ),
      materialSamples: this.materialSamples,
    };
  }

  private renderOverlays(batches: TerrainBatches, options: TerrainAtlasRenderOptions): void {
    this.overlayLayers.beginFrame();
    this.surfaceTint.render(batches, {
      projection: options.projection,
      biomeAt: options.biomeTintAt ?? options.biomeAt,
      // The shared atlas has authored biome/territory floor and wall roles.
      // A second full-floor Graphics wash only adds overdraw and display
      // objects; fallback materials retain the tint path when no atlas exists.
      biomeEnabled: false,
      bedrockEnabled: this.visualFeatures.bedrockTint,
    }, this.visible);
    this.aoOverlay.render(batches.ao, options.projection, {
      enabled: this.visualFeatures.ambientOcclusion,
      visible: this.visible,
    });
    this.cliffHighlight.render(
      batches.cliffEdges,
      options.projection,
      this.visible && this.visualFeatures.cliffHighlights,
    );
    this.overlayLayers.endFrame();
  }

  private syncMeshes(meshes: readonly TerrainMeshBatch[]): void {
    this.active = new Set(meshes.map(meshKey));
    for (const batch of meshes) this.updateMesh(batch);
    this.pruneInactiveMeshes();
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const [key, mesh] of this.meshes) mesh.setVisible(visible && this.active.has(key));
    this.overlayLayers.setVisible(visible);
  }

  destroy(): void {
    for (const mesh of this.meshes.values()) mesh.destroy();
    this.meshes.clear();
    this.overlayLayers.destroy();
  }

  private updateMesh(batch: TerrainMeshBatch): void {
    const key = meshKey(batch);
    const mesh = this.meshes.get(key) ?? this.scene.add.mesh2d(0, 0, batch.atlas.key, [], []);
    mesh.setFlip(false, false);
    mesh.vertices = batch.vertices;
    mesh.indices = batch.indices;
    mesh.buildOrderedIndices(2, true);
    mesh.setDepth(batch.depth).setVisible(this.visible);
    this.meshes.set(key, mesh);
  }

  private pruneInactiveMeshes(): void {
    pruneTerrainMeshes({
      meshes: this.meshes,
      active: this.active,
      visible: this.visible,
    });
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
