import { TERRAIN } from "@dc2d/engine";
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { TilePos } from "../../lighting/torches/torchPlacement.js";
import type { DynamicLightSeed } from "../../terrain/shading/tileLight.js";
import { viewToWorld, worldToView } from "../../view/transform/viewTransform.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { createPhaser4TerrainQuadBatchRenderer } from "../batch/phaser4QuadBatch.js";
import { Phaser4TerrainAtlasBatchRenderer } from "../batch/phaser4AtlasBatch.js";
import { TERRAIN4, type Terrain4Rect, type Terrain4Source } from "../planning/terrainPlanner.js";
import { appendVisibleChunkPlans, emptyTerrain4Batches, Terrain4ChunkPlanCache } from "../planning/terrain4ChunkCache.js";
import { syncTerrain4Props } from "./terrain4Props.js";
import { terrain4FeatureForTile, terrain4PropForTile } from "../planning/terrain4TileFeatures.js";
import type { Terrain4Root } from "./terrain4Root.js";
import type { Terrain4World } from "./terrain4World.js";
import {
  materialsFor, screenProjection, worldBiomeAt, worldBoundsForView, TERRAIN_DEPTH,
} from "./terrain4RenderSupport.js";
export interface TerrainRendererLike {
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}
export class Terrain4Renderer {
  private readonly roots = new Map<ViewOrientation, Terrain4Root>();
  private readonly debugMode = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("terrain4Debug") === "1";
  private readonly chunkCache = new Terrain4ChunkPlanCache();
  private readonly terrainSource: Terrain4Source;
  private dirty = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: Terrain4World,
  ) {
    this.terrainSource = {
      terrainAt: (x, y) => this.world.terrainAt(x, y) === TERRAIN.Void ? TERRAIN4.Void : TERRAIN4.Floor,
      heightAt: (x, y) => this.world.heightAt(x, y),
      featureAt: (x, y) => terrain4FeatureForTile(this.world.tileAt(x, y)),
      propAt: (x, y) => terrain4PropForTile(this.world.tileAt(x, y)),
    };
    this.ensureRoot(getViewOrientation());
  }
  update(view: ViewRect): void {
    const orientation = getViewOrientation();
    const root = this.ensureRoot(orientation);
    const hasAtlasAssets = this.hasAtlasAsset();
    const bounds = worldBoundsForView(view, orientation);
    const key = `${orientation}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${this.world.tileRevision}`;
    if (this.dirty || root.planKey !== key) {
      this.renderRoot(root, bounds, key);
      this.dirty = false;
    }
    this.syncRootVisibility(orientation, hasAtlasAssets);
  }
  private syncRootVisibility(orientation: ViewOrientation, hasAtlasAssets: boolean): void {
    for (const [candidate, candidateRoot] of this.roots) {
      candidateRoot.graphics.setVisible(candidate === orientation && !hasAtlasAssets);
      candidateRoot.atlas.setVisible(candidate === orientation);
      for (const prop of candidateRoot.props.values()) prop.setVisible(candidate === orientation);
    }
  }
  prewarmRotation(view: ViewRect, direction: 1 | -1): void {
    const current = getViewOrientation();
    const next = rotateOrientation(current, direction);
    const root = this.ensureRoot(next);
    const centerView = {
      x: (view.x + view.width / 2) / SCREEN_TILE_PX,
      y: (view.y + view.height / 2) / SCREEN_TILE_PX,
    };
    const centerWorld = viewToWorld(centerView, current);
    const nextCenterView = worldToView(centerWorld, next);
    const nextView = {
      x: nextCenterView.x * SCREEN_TILE_PX - view.width / 2,
      y: nextCenterView.y * SCREEN_TILE_PX - view.height / 2,
      width: view.width,
      height: view.height,
    };
    const bounds = worldBoundsForView(nextView, next);
    const key = `${next}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${this.world.tileRevision}`;
    if (root.planKey !== key) this.renderRoot(root, bounds, key);
  }
  setDynamicLights(lights: readonly DynamicLightSeed[]): void {
    void lights;
  }
  rebuildAffected(tiles: readonly TilePos[]): void {
    for (const tile of tiles) this.chunkCache.invalidateTile(tile.wx, tile.wy);
    this.dirty = true;
  }
  rebakeAllNow(): void {
    // RotationController calls this at the midpoint for the legacy renderer.
    // Terrain4 has already prewarmed the destination root, so clearing it here
    // would turn a zero-cost atomic swap back into a visible rebuild.
  }
  invalidateAll(): void {
    this.dirty = true;
    this.chunkCache.clear();
    for (const root of this.roots.values()) root.planKey = "";
  }
  get loadedChunkCount(): number {
    return this.chunkCache.size;
  }
  dispose(): void {
    for (const root of this.roots.values()) {
      root.graphics.destroy();
      root.atlas.destroy();
      for (const prop of root.props.values()) prop.destroy();
    }
    this.roots.clear();
  }
  private ensureRoot(orientation: ViewOrientation): Terrain4Root {
    const existing = this.roots.get(orientation);
    if (existing) return existing;
    const batch = createPhaser4TerrainQuadBatchRenderer(this.scene);
    const graphics = batch.graphics.setDepth(TERRAIN_DEPTH).setVisible(false);
    const root: Terrain4Root = {
      graphics,
      batch,
      atlas: new Phaser4TerrainAtlasBatchRenderer(this.scene),
      props: new Map(),
      planKey: "",
      orientation,
    };
    this.roots.set(orientation, root);
    return root;
  }
  private renderRoot(root: Terrain4Root, bounds: Terrain4Rect, key: string): void {
    const plan = emptyTerrain4Batches();
    appendVisibleChunkPlans({ target: plan, cache: this.chunkCache, source: this.terrainSource, bounds, orientation: root.orientation, revision: this.world.tileRevision });
    if (this.hasAtlasAsset()) {
      root.atlas.render(plan, {
        projection: screenProjection,
        biomeAt: (tile) => worldBiomeAt(this.world, tile.x, tile.y),
        debug: this.debugMode,
      });
      root.graphics.setVisible(false);
    } else {
      root.batch.render(plan, screenProjection, materialsFor(this.world, bounds));
    }
    syncTerrain4Props({ scene: this.scene, root, props: plan.props });
    root.planKey = key;
  }

  private hasAtlasAsset(): boolean {
    const key = this.debugMode ? ASSET_KEYS.terrain4Debug : ASSET_KEYS.terrain4Uniform;
    return this.scene.textures.exists(key);
  }
}
