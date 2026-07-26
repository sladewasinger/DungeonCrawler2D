// Terrain rendering facade: streams completed chunk visuals around the camera
// while advancing new GPU-backed chunk builds inside a bounded frame budget.
import { World } from "@dc2d/engine";
import Phaser from "phaser";
import type { TilePos } from "../lighting/torchPlacement.js";
import { getViewOrientation } from "../view/viewState.js";
import { runBuildBudget } from "./buildBudget.js";
import {
  createChunkVisualBuilder,
  destroyChunkVisual,
  type ChunkVisual,
  type ChunkVisualBuilder,
} from "./chunkVisual.js";
import { affectedChunkKeys } from "./lightRebake.js";
import {
  chunkKey,
  desiredChunks,
  diffChunks,
  planBakes,
  SettledChunkWindow,
  type ChunkCoord,
  type ViewRect,
} from "./streaming.js";
import type { DynamicLightSeed } from "./tileLight.js";
import { readTerrainDeviceSignals, selectTerrainDeviceProfile, type TerrainDeviceProfile } from "./terrainDeviceProfile.js";
import { configureTerrainPages, terrainPageMemoryFor } from "./terrainPages.js";

const BUILD_BUDGET_MS = 4;
const MAX_BUILD_STARTS_PER_FRAME = 2;
const MAX_MARGIN_BUILD_STARTS_PER_FRAME = 1;
export class TerrainRenderer {
  private readonly visuals = new Map<string, ChunkVisual>();
  private readonly builders = new Map<string, ChunkVisualBuilder>();
  private readonly bakeQueue: ChunkCoord[] = [];
  private readonly settledWindow = new SettledChunkWindow();
  private readonly pageProfile: TerrainDeviceProfile;
  private dynamicLights: readonly DynamicLightSeed[] = [];
  private tileRevision: number;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.tileRevision = world.tileRevision;
    this.pageProfile = configureTerrainPages(
      scene.textures,
      selectTerrainDeviceProfile(readTerrainDeviceSignals(scene)),
    );
  }

  update(view: ViewRect): void {
    this.invalidateChangedTiles();
    if (this.canSkipSettledWindow(view)) return;
    const desired = desiredChunks(view, this.pageProfile.loadMarginChunks);
    const knownKeys = new Set([
      ...this.visuals.keys(),
      ...this.builders.keys(),
      ...this.bakeQueue.map(chunkKey),
    ]);
    const { toLoad, toUnloadKeys } = diffChunks(desired, knownKeys);
    this.bakeQueue.push(...toLoad);
    for (const key of toUnloadKeys) this.unload(key);

    const desiredKeys = new Set(desired.map(chunkKey));
    const viewKeys = new Set(desiredChunks(view, 0).map(chunkKey));
    this.cancelUndesiredBuilders(desiredKeys);
    const { bake, keep } = planBakes(
      this.bakeQueue,
      desiredKeys,
      viewKeys,
      MAX_BUILD_STARTS_PER_FRAME,
      MAX_MARGIN_BUILD_STARTS_PER_FRAME,
    );
    this.bakeQueue.length = 0;
    this.bakeQueue.push(...keep);

    for (const coord of bake) this.startBuild(coord);
    runBuildBudget(
      () => this.builders.size > 0,
      () => this.advanceBuild(viewKeys),
      BUILD_BUDGET_MS,
      () => performance.now(),
    );
    this.captureSettledWindow(view);
  }

  private invalidateChangedTiles(): void {
    if (this.tileRevision === this.world.tileRevision) return;
    this.tileRevision = this.world.tileRevision;
    this.invalidateAll();
  }

  private canSkipSettledWindow(view: ViewRect): boolean {
    return this.settledWindow.canSkip(
      view, this.builders.size, this.bakeQueue.length,
      this.pageProfile.loadMarginChunks,
    );
  }

  private captureSettledWindow(view: ViewRect): void {
    this.settledWindow.captureIfIdle(
      view, this.builders.size, this.bakeQueue.length,
      this.pageProfile.loadMarginChunks,
    );
  }

  rebakeAllNow(): void {
    this.settledWindow.reset();
    for (const builder of this.builders.values()) builder.cancel();
    this.builders.clear();
    this.bakeQueue.length = 0;
    for (const key of this.visuals.keys()) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      this.startBuild({ cx, cy });
    }
  }

  setDynamicLights(lights: readonly DynamicLightSeed[]): void {
    this.dynamicLights = lights;
  }

  rebuildAffected(tiles: readonly TilePos[]): void {
    for (const key of affectedChunkKeys(tiles, getViewOrientation())) {
      if (!this.visuals.has(key)) continue;
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      this.startBuild({ cx, cy });
    }
  }

  private startBuild(coord: ChunkCoord): void {
    const key = chunkKey(coord);
    this.builders.get(key)?.cancel();
    this.builders.set(
      key,
      createChunkVisualBuilder(
        this.scene,
        this.world,
        coord.cx,
        coord.cy,
        getViewOrientation(),
        this.dynamicLights,
      ),
    );
  }

  private advanceBuild(viewKeys: ReadonlySet<string>): void {
    const entry = this.nextBuilder(viewKeys);
    if (!entry) return;
    const [key, builder] = entry;
    const visual = builder.step();
    if (!visual) return;
    this.builders.delete(key);
    const existing = this.visuals.get(key);
    if (existing) destroyChunkVisual(existing);
    this.visuals.set(key, visual);
  }

  private nextBuilder(viewKeys: ReadonlySet<string>): [string, ChunkVisualBuilder] | undefined {
    for (const entry of this.builders) {
      if (viewKeys.has(entry[0])) return entry;
    }
    return this.builders.entries().next().value as [string, ChunkVisualBuilder] | undefined;
  }

  private cancelUndesiredBuilders(desiredKeys: ReadonlySet<string>): void {
    for (const [key, builder] of this.builders) {
      if (desiredKeys.has(key)) continue;
      builder.cancel();
      this.builders.delete(key);
    }
  }

  private unload(key: string): void {
    const builder = this.builders.get(key);
    if (builder) {
      builder.cancel();
      this.builders.delete(key);
    }
    const visual = this.visuals.get(key);
    if (!visual) return;
    destroyChunkVisual(visual);
    this.visuals.delete(key);
  }

  invalidateAll(): void {
    this.settledWindow.reset();
    for (const builder of this.builders.values()) builder.cancel();
    this.builders.clear();
    this.bakeQueue.length = 0;
    for (const key of [...this.visuals.keys()]) this.unload(key);
  }

  get loadedChunkCount(): number {
    return this.visuals.size;
  }

  diagnostics() {
    return {
      profile: this.pageProfile.kind,
      loadedChunks: this.visuals.size,
      buildingChunks: this.builders.size,
      queuedChunks: this.bakeQueue.length,
      ...terrainPageMemoryFor(this.scene.textures),
    };
  }

  dispose(): void {
    this.invalidateAll();
  }
}
