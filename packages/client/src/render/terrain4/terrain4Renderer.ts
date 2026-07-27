import { TERRAIN, type World } from "@dc2d/engine";
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { TilePos } from "../lighting/torchPlacement.js";
import type { DynamicLightSeed } from "../terrain/tileLight.js";
import { viewToWorld, worldToView } from "../view/viewTransform.js";
import { getViewOrientation } from "../view/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../view/viewOrientation.js";
import type { ViewRect } from "../terrain/streaming.js";
import {
  createPhaser4TerrainQuadBatchRenderer,
  type Phaser4TerrainQuadBatchRenderer,
} from "./phaser4QuadBatch.js";
import { Phaser4TerrainAtlasBatchRenderer } from "./phaser4AtlasBatch.js";
import { planTerrain4, TERRAIN4, type Terrain4Rect } from "./terrainPlanner.js";
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
  private dirty = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
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
    void tiles;
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
    for (const root of this.roots.values()) root.planKey = "";
  }

  get loadedChunkCount(): number {
    return this.roots.size;
  }

  dispose(): void {
    for (const root of this.roots.values()) {
      root.graphics.destroy();
      root.atlas.destroy();
      for (const label of root.debugLabels) label.destroy();
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
      atlas: new Phaser4TerrainAtlasBatchRenderer(this.scene, TERRAIN_DEPTH),
      debugLabels: [],
      planKey: "",
      orientation,
    };
    this.roots.set(orientation, root);
    return root;
  }

  private renderRoot(root: Terrain4Root, bounds: Terrain4Rect, key: string): void {
    const plan = planTerrain4({
      terrainAt: (x, y) => this.world.terrainAt(x, y) === TERRAIN.Void ? TERRAIN4.Void : TERRAIN4.Floor,
      heightAt: (x, y) => this.world.heightAt(x, y),
    }, { bounds, orientation: root.orientation, seamApron: 1 });
    if (this.scene.textures.exists("terrain4-biomes")) {
      root.atlas.render(plan.batches, {
        projection: screenProjection,
        biomeAt: (tile) => worldBiomeAt(this.world, tile.x, tile.y),
        debug: this.debugMode,
      });
      root.graphics.setVisible(false);
    } else {
      root.batch.render(plan.batches, screenProjection, materialsFor(this.world, bounds));
    }
    if (this.debugMode) renderDebugLabels(this.scene, root, plan, root.orientation === getViewOrientation());
    root.planKey = key;
  }
}
