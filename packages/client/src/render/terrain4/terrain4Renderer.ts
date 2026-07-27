import { TERRAIN, TILE, type World } from "@dc2d/engine";
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import type { TilePos } from "../lighting/torchPlacement.js";
import type { DynamicLightSeed } from "../terrain/tileLight.js";
import { viewToWorld, worldToView } from "../view/viewTransform.js";
import { getViewOrientation } from "../view/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../view/viewOrientation.js";
import type { ViewRect } from "../terrain/streaming.js";
import { depthForCapOccluder } from "../entities/depthSort.js";
import {
  createPhaser4TerrainQuadBatchRenderer,
  type Phaser4TerrainQuadBatchRenderer,
} from "./phaser4QuadBatch.js";
import { Phaser4TerrainAtlasBatchRenderer } from "./phaser4AtlasBatch.js";
import { TERRAIN4, type Terrain4Rect, type Terrain4Source } from "./terrainPlanner.js";
import { appendVisibleChunkPlans, emptyTerrain4Batches, Terrain4ChunkPlanCache } from "./terrain4ChunkCache.js";
import {
  materialsFor, renderDebugLabels, screenProjection, worldBiomeAt, worldBoundsForView, TERRAIN_DEPTH,
  type Terrain4DebugHost,
} from "./terrain4RenderSupport.js";

/** Public terrain seam consumed by dungeon orchestration and torch syncing. */
export interface TerrainRendererLike {
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}

interface Terrain4Root extends Terrain4DebugHost {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly batch: Phaser4TerrainQuadBatchRenderer;
  readonly atlas: Phaser4TerrainAtlasBatchRenderer;
  readonly debugLabels: Phaser.GameObjects.Text[];
  readonly props: Map<string, Phaser.GameObjects.Sprite>;
  planKey: string;
  orientation: ViewOrientation;
}

/**
 * Small Phaser-facing adapter for the pure Terrain4 planner. Each cardinal
 * orientation owns a hidden Graphics root that can be filled before input
 * commits the new orientation. The old root remains visible until that atomic
 * swap, so rotation never exposes a cleared canvas.
 */
export class Terrain4Renderer {
  private readonly roots = new Map<ViewOrientation, Terrain4Root>();
  private readonly debugMode = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("terrain4Debug") === "1";
  private readonly debugLegend: Phaser.GameObjects.Image | null;
  private readonly chunkCache = new Terrain4ChunkPlanCache();
  private readonly terrainSource: Terrain4Source;
  private dirty = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.terrainSource = {
      terrainAt: (x, y) => this.world.terrainAt(x, y) === TERRAIN.Void ? TERRAIN4.Void : TERRAIN4.Floor,
      heightAt: (x, y) => this.world.heightAt(x, y),
      featureAt: (x, y) => featureForTile(this.world.tileAt(x, y)),
      propAt: (x, y) => propForTile(this.world.tileAt(x, y)),
    };
    this.debugLegend = this.debugMode
      ? scene.add.image(8, 8, ASSET_KEYS.terrain4Debug)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(TERRAIN_DEPTH + 2000).setScale(0.12).setAlpha(0.9)
      : null;
    this.ensureRoot(getViewOrientation());
  }

  update(view: ViewRect): void {
    const orientation = getViewOrientation();
    const root = this.ensureRoot(orientation);
    const bounds = worldBoundsForView(view, orientation);
    const key = `${orientation}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${this.world.tileRevision}`;
    if (this.dirty || root.planKey !== key) {
      this.renderRoot(root, bounds, key);
      this.dirty = false;
    }
    for (const [candidate, candidateRoot] of this.roots) {
      candidateRoot.graphics.setVisible(candidate === orientation && !this.scene.textures.exists("terrain4-biomes"));
      candidateRoot.atlas.setVisible(candidate === orientation);
      for (const label of candidateRoot.debugLabels) {
        label.setVisible(this.debugMode && candidate === orientation);
      }
      for (const prop of candidateRoot.props.values()) prop.setVisible(candidate === orientation);
    }
  }

  /** Builds the next orientation while the current root remains visible. */
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

  /** A prepared root is already complete; never tear it down at the midpoint. */
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
      for (const label of root.debugLabels) label.destroy();
      for (const prop of root.props.values()) prop.destroy();
    }
    this.roots.clear();
    this.debugLegend?.destroy();
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
      debugLabels: [],
      props: new Map(),
      planKey: "",
      orientation,
    };
    this.roots.set(orientation, root);
    return root;
  }

  private renderRoot(root: Terrain4Root, bounds: Terrain4Rect, key: string): void {
    const plan = emptyTerrain4Batches();
    appendVisibleChunkPlans(plan, this.chunkCache, this.terrainSource, bounds, root.orientation, this.world.tileRevision);
    if (this.scene.textures.exists("terrain4-biomes")) {
      root.atlas.render(plan, {
        projection: screenProjection,
        biomeAt: (tile) => worldBiomeAt(this.world, tile.x, tile.y),
        debug: this.debugMode,
      });
      root.graphics.setVisible(false);
    } else {
      root.batch.render(plan, screenProjection, materialsFor(this.world, bounds));
    }
    syncProps(this.scene, root, plan.props);
    if (this.debugMode) renderDebugLabels(this.scene, root, plan, root.orientation === getViewOrientation());
    root.planKey = key;
  }
}

function featureForTile(tile: number): "stairs" | "door" | "brazier" | null {
  if (tile === TILE.Stairs) return "stairs";
  if (tile === TILE.DoorPersonal || tile === TILE.DoorParty || tile === TILE.DoorExit || tile === TILE.DoorSafeRoom) return "door";
  return null;
}

function propForTile(tile: number): "crafting-table" | "stash" | null {
  if (tile === TILE.CraftingTable) return "crafting-table";
  if (tile === TILE.Stash) return "stash";
  return null;
}

function syncProps(
  scene: Phaser.Scene,
  root: Terrain4Root,
  props: Terrain4BatchesProps,
): void {
  const active = new Set<string>();
  for (const prop of props) {
    const key = `${prop.worldTile.x},${prop.worldTile.y}`;
    active.add(key);
    const frame = prop.prop === "crafting-table" ? "crafting_table" : "chest_full_open_anim_f0";
    const sprite = root.props.get(key) ?? scene.add.sprite(0, 0, ASSET_KEYS.atlas, frame);
    sprite.setTexture(ASSET_KEYS.atlas, frame)
      .setOrigin(0.5, 1)
      .setScale(WORLD_PIXEL_SCALE)
      .setPosition((prop.viewTile.x + 0.5) * SCREEN_TILE_PX, (prop.viewTile.y + 1) * SCREEN_TILE_PX - prop.height * SCREEN_TILE_PX)
      .setDepth(depthForCapOccluder(prop.viewTile.y) + 0.1)
      .setVisible(root.orientation === getViewOrientation());
    root.props.set(key, sprite);
  }
  for (const [key, sprite] of root.props) {
    if (active.has(key)) continue;
    sprite.destroy();
    root.props.delete(key);
  }
}

type Terrain4BatchesProps = ReturnType<typeof emptyTerrain4Batches>["props"];
