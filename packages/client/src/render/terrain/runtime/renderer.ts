import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { TilePos } from "../../lighting/torches/torchPlacement.js";
import type { DynamicLightSeed } from "../../terrain/shading/tileLight.js";
import { viewToWorld, worldToView } from "../../view/transform/viewTransform.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import type { TerrainRect, TerrainSource } from "../planning/terrainPlanner.js";
import { appendVisibleChunkPlans, emptyTerrainBatches, TerrainChunkPlanCache } from "../planning/chunkCache.js";
import { syncTerrainProps } from "./props.js";
import {
  createTerrainRoot,
  destroyTerrainRoot,
  type TerrainRoot,
} from "./root.js";
import type { TerrainWorld } from "./world.js";
import { materialsFor, screenProjection, worldBiomeAt, worldBoundsForView } from "./renderSupport.js";
import { TerrainCameraBackground } from "./cameraBackground.js";
import { createTerrainSource } from "./source.js";
import { terrainDebugIsEnabled } from "./debugMode.js";
import { TerrainRootRetention } from "./rootRetention.js";
import { TERRAIN_RUNTIME_TUNING } from "../terrainRuntimeTuning.js";

export interface TerrainRendererLike {
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}
export class TerrainRenderer {
  private readonly roots: TerrainRootRetention;
  private readonly debugMode = typeof window !== "undefined" &&
    terrainDebugIsEnabled(window.location.search);
  private readonly chunkCache = new TerrainChunkPlanCache();
  private readonly terrainSource: TerrainSource;
  private readonly cameraBackground: TerrainCameraBackground;
  private dirty = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: TerrainWorld,
  ) {
    this.terrainSource = createTerrainSource(world);
    this.cameraBackground = new TerrainCameraBackground(scene.cameras.main);
    this.roots = new TerrainRootRetention({
      capacity: TERRAIN_RUNTIME_TUNING.retention.maxOrientationRoots,
      create: (orientation) => createTerrainRoot(this.scene, orientation),
      destroy: destroyTerrainRoot,
    });
    this.ensureRoot(getViewOrientation());
  }
  update(view: ViewRect): void {
    const orientation = getViewOrientation();
    const root = this.ensureRoot(orientation);
    this.roots.retain(new Set([orientation]));
    const hasAtlasAssets = this.scene.textures.exists(this.debugMode ? ASSET_KEYS.debugAtlas : ASSET_KEYS.sharedAtlas);
    const bounds = worldBoundsForView(view, orientation);
    this.cameraBackground.sync(view, orientation);
    const key = `${orientation}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${this.world.tileRevision}`;
    if (this.dirty || root.planKey !== key) {
      this.renderRoot(root, bounds, key);
      this.dirty = false;
    }
    this.pruneWorldChunks(bounds);
    this.syncRootVisibility(orientation, hasAtlasAssets);
  }
  private syncRootVisibility(orientation: ViewOrientation, hasAtlasAssets: boolean): void {
    for (const root of this.roots.values()) {
      root.graphics.setVisible(root.orientation === orientation && !hasAtlasAssets);
      root.atlas.setVisible(root.orientation === orientation);
      for (const prop of root.props.values()) prop.setVisible(root.orientation === orientation);
    }
  }
  prewarmRotation(view: ViewRect, direction: 1 | -1): void {
    const current = getViewOrientation();
    const next = rotateOrientation(current, direction);
    const root = this.ensureRoot(next);
    this.roots.retain(new Set([current, next]));
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
    // Terrain has already prewarmed the destination root, so clearing it here
    // would turn a zero-cost atomic swap back into a visible rebuild.
  }
  invalidateAll(): void {
    this.dirty = true;
    this.chunkCache.clear();
    for (const root of this.roots.values()) root.planKey = "";
  }
  get loadedChunkCount(): number { return this.chunkCache.size; }

  dispose(): void { this.roots.clear(); }

  private ensureRoot(orientation: ViewOrientation): TerrainRoot {
    return this.roots.acquire(orientation);
  }

  private pruneWorldChunks(bounds: TerrainRect): void {
    this.world.pruneChunkCache?.(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      TERRAIN_RUNTIME_TUNING.retention.maxWorldChunks,
    );
  }
  private renderRoot(root: TerrainRoot, bounds: TerrainRect, key: string): void {
    const plan = emptyTerrainBatches();
    appendVisibleChunkPlans({ target: plan, cache: this.chunkCache, source: this.terrainSource, bounds, orientation: root.orientation, revision: this.world.tileRevision });
    if (this.scene.textures.exists(this.debugMode ? ASSET_KEYS.debugAtlas : ASSET_KEYS.sharedAtlas)) {
      root.atlas.render(plan, {
        projection: screenProjection,
        biomeAt: (tile) => worldBiomeAt(this.world, tile.x, tile.y),
        debug: this.debugMode,
      });
      root.graphics.setVisible(false);
    } else {
      root.batch.render(plan, screenProjection, materialsFor(this.world, bounds));
    }
    syncTerrainProps({ scene: this.scene, root, props: plan.props });
    root.planKey = key;
  }
}
