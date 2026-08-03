import Phaser from "phaser";
import type { TilePos } from "../../lighting/torches/torchPlacement.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import type { DynamicLightSeed } from "../shading/tileLight.js";
import type { TerrainRect, TerrainSource } from "../planning/terrainPlanner.js";
import { TerrainChunkPlanCache } from "../planning/chunkCache.js";
import { createTerrainRoot, destroyTerrainRoot, type TerrainRoot } from "./root.js";
import type { TerrainWorld } from "./world.js";
import { TerrainCameraBackground } from "./background/cameraBackground.js";
import { createTerrainSource } from "./source.js";
import { terrainDebugIsEnabled } from "./debugMode.js";
import { TerrainRootRetention } from "./rootRetention.js";
import { terrainDeviceProfileForScene, type TerrainDeviceProfile } from "../streaming/terrainDeviceProfile.js";
import type { TerrainRendererLike } from "../rendererPort.js";
import { clipTerrainBounds, isRoomIsolationView, rotatedTerrainView, terrainBoundsForWorld } from "../streaming/terrainView.js";
import { hasAtlasAssets, pruneTerrainWorldChunks, renderTerrainRoot } from "./presentation/rootPresentation.js";
import type { WorldPresentationVisibility } from "../../visibility/worldPresentationVisibility.js";
import { TerrainPresentationState } from "./presentation/terrainPresentationState.js";
import { TERRAIN_RUNTIME_TUNING } from "../terrainRuntimeTuning.js";
import { measureRuntimeWork } from "../../../performance/runtimeWorkMetrics.js";
import {
  recordTerrainRootVisibility,
  terrainRootVisibilityDebug,
} from "./presentation/terrainRenderDebug.js";

export class TerrainRenderer implements TerrainRendererLike {
  private readonly roots: TerrainRootRetention;
  private readonly debugMode = typeof window !== "undefined" &&
    terrainDebugIsEnabled(window.location.search);
  private readonly chunkCache: TerrainChunkPlanCache;
  private readonly terrainSource: TerrainSource;
  private readonly cameraBackground: TerrainCameraBackground;
  private readonly deviceProfile: TerrainDeviceProfile;
  private readonly presentation = new TerrainPresentationState();
  private dirty = true;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: TerrainWorld,
    deviceProfile = terrainDeviceProfileForScene(scene),
  ) {
    this.deviceProfile = deviceProfile;
    this.chunkCache = new TerrainChunkPlanCache(this.deviceProfile.retention.maxChunkPlans);
    this.terrainSource = createTerrainSource(world);
    this.cameraBackground = new TerrainCameraBackground(scene.cameras.main);
    this.roots = new TerrainRootRetention({ capacity: this.deviceProfile.retention.maxOrientationRoots,
      create: (orientation) => createTerrainRoot(this.scene, orientation, this.deviceProfile), destroy: destroyTerrainRoot });
    this.ensureRoot(getViewOrientation());
  }
  update(view: ViewRect): void {
    const orientation = getViewOrientation();
    const root = this.ensureRoot(orientation);
    this.roots.retain(new Set([orientation]));
    const atlasAssetsReady = hasAtlasAssets(this.scene, this.debugMode);
    const viewBounds = terrainBoundsForWorld({ view, orientation, profile: this.deviceProfile,
      finiteFloor: this.world.floorBounds != null });
    const bounds = clipTerrainBounds(viewBounds, this.world.floorBounds, isRoomIsolationView(viewBounds));
    this.cameraBackground.sync(view, orientation, this.presentation.visibility?.backgroundColor);
    const key = this.presentation.planKey({
      orientation,
      bounds,
      tileRevision: this.world.tileRevision,
    });
    if (this.dirty || root.planKey !== key) {
      this.dirty = this.renderRoot(root, bounds, key) > 0;
    }
    pruneTerrainWorldChunks({
      world: this.world,
      bounds,
      capacity: this.deviceProfile.retention.maxWorldChunks,
    });
    this.syncRootVisibility(orientation, atlasAssetsReady);
    recordTerrainRootVisibility(
      terrainRootVisibilityDebug(this.roots.values(), orientation),
    );
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
    const nextView = rotatedTerrainView(view, current, next);
    const viewBounds = terrainBoundsForWorld({
      view: nextView, orientation: next, profile: this.deviceProfile,
      finiteFloor: this.world.floorBounds != null,
    });
    const bounds = clipTerrainBounds(viewBounds, this.world.floorBounds, isRoomIsolationView(viewBounds));
    const key = this.presentation.planKey({
      orientation: next,
      bounds,
      tileRevision: this.world.tileRevision,
    });
    if (root.planKey !== key) this.renderRoot(root, bounds, key);
  }
  setDynamicLights(lights: readonly DynamicLightSeed[]): void {
    void lights;
  }
  setWorldVisibility(visibility: WorldPresentationVisibility | null): void {
    if (this.presentation.setVisibility(visibility)) this.dirty = true;
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
  get submittedTerrainQuadCount(): number { return this.presentation.submittedQuadCount; }
  get candidateTerrainQuadCount(): number { return this.presentation.candidateQuadCount; }
  get constrainedPresentation(): boolean {
    return this.deviceProfile.kind === "constrained";
  }
  dispose(): void {
    this.roots.clear();
  }
  private ensureRoot(orientation: ViewOrientation): TerrainRoot { return this.roots.acquire(orientation); }

  private renderRoot(root: TerrainRoot, bounds: TerrainRect, key: string): number {
    return measureRuntimeWork("terrain.renderRoot", () => {
      const result = renderTerrainRoot({
        scene: this.scene,
        root,
        bounds,
        cache: this.chunkCache,
        source: this.terrainSource,
        world: this.world,
        profile: this.deviceProfile,
        visibility: this.presentation.visibility,
        debug: this.debugMode,
        maxNewChunkPlans: TERRAIN_RUNTIME_TUNING.retention.maxNewChunkPlansPerFrame,
      });
      this.presentation.record(result.metrics);
      root.planKey = result.pendingChunkPlans === 0 ? key : "";
      return result.pendingChunkPlans;
    });
  }
}
