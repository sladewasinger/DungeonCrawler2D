import { BIOME, TERRAIN, biomeAtWorldTile, type BiomeKind, type World } from "@dc2d/engine";
import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { TilePos } from "../lighting/torchPlacement.js";
import type { DynamicLightSeed } from "../terrain/tileLight.js";
import { viewTileToWorld } from "../view/viewTransform.js";
import { getViewOrientation } from "../view/viewState.js";
import { rotateOrientation, type ViewOrientation } from "../view/viewOrientation.js";
import type { ViewRect } from "../terrain/streaming.js";
import {
  createPhaser4TerrainQuadBatchRenderer,
  type Phaser4TerrainQuadBatchRenderer,
  type Terrain4ScreenProjection,
} from "./phaser4QuadBatch.js";
import { planTerrain4, TERRAIN4, type Terrain4Rect } from "./terrainPlanner.js";

const VIEW_MARGIN_TILES = 2;
const TERRAIN_DEPTH = -1000;

/** Public terrain seam consumed by dungeon orchestration and torch syncing. */
export interface TerrainRendererLike {
  update(view: ViewRect): void;
  setDynamicLights(lights: readonly DynamicLightSeed[]): void;
  rebuildAffected(tiles: readonly TilePos[]): void;
  rebakeAllNow(): void;
  invalidateAll(): void;
  dispose(): void;
}

const BIOME_MATERIALS: Readonly<Record<BiomeKind, { floor: number; face: number }>> = {
  [BIOME.Maze]: { floor: 0x526579, face: 0x2d3c4d },
  [BIOME.OpenHalls]: { floor: 0xb28a52, face: 0x6e4d2d },
  [BIOME.Ruins]: { floor: 0x68715b, face: 0x3c4536 },
  [BIOME.Pillars]: { floor: 0x687458, face: 0x3a4537 },
  [BIOME.Pools]: { floor: 0x3c91aa, face: 0x20536c },
  [BIOME.Arena]: { floor: 0x9d5b43, face: 0x5b2c2a },
};

interface Terrain4Root {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly batch: Phaser4TerrainQuadBatchRenderer;
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
  private currentKey = "";
  private dirty = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.ensureRoot(getViewOrientation());
  }

  update(view: ViewRect): void {
    const orientation = getViewOrientation();
    const root = this.ensureRoot(orientation);
    const bounds = worldBoundsForView(view, orientation);
    const key = `${orientation}:${bounds.x},${bounds.y},${bounds.width},${bounds.height}:${this.world.tileRevision}`;
    if (this.dirty || key !== this.currentKey || root.planKey !== key) {
      this.renderRoot(root, bounds, key);
      this.currentKey = key;
      this.dirty = false;
    }
    for (const [candidate, candidateRoot] of this.roots) {
      candidateRoot.graphics.setVisible(candidate === orientation);
      for (const label of candidateRoot.debugLabels) {
        label.setVisible(this.debugMode && candidate === orientation);
      }
    }
  }

  /** Builds the next orientation while the current root remains visible. */
  prewarmRotation(view: ViewRect, direction: 1 | -1): void {
    const next = rotateOrientation(getViewOrientation(), direction);
    const root = this.ensureRoot(next);
    const bounds = worldBoundsForView(view, next);
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
    this.currentKey = "";
    for (const root of this.roots.values()) root.planKey = "";
  }

  get loadedChunkCount(): number {
    return this.roots.size;
  }

  dispose(): void {
    for (const root of this.roots.values()) root.graphics.destroy();
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
    root.batch.render(plan.batches, screenProjection, materialsFor(this.world, bounds));
    if (this.debugMode) renderDebugLabels(this.scene, root, plan);
    root.planKey = key;
  }
}

const DEBUG_LABELS: Readonly<Record<"floor" | "void" | "south-face", string>> = {
  floor: "F",
  void: "V",
  "south-face": "D",
};

function renderDebugLabels(
  scene: Phaser.Scene,
  root: Terrain4Root,
  plan: ReturnType<typeof planTerrain4>,
): void {
  const entries = [...plan.batches.floors, ...plan.batches.voids, ...plan.batches.southFaces];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    const label = root.debugLabels[index] ?? createDebugLabel(scene, root);
    const center = entry.vertices.reduce(
      (sum, vertex) => ({ x: sum.x + vertex.x / 4, y: sum.y + vertex.y / 4, z: sum.z + vertex.z / 4 }),
      { x: 0, y: 0, z: 0 },
    );
    const screen = screenProjection.project(center);
    label.setText(DEBUG_LABELS[entry.kind]).setPosition(screen.x, screen.y).setVisible(true);
  }
  for (let index = entries.length; index < root.debugLabels.length; index++) {
    root.debugLabels[index]?.setVisible(false);
  }
}

function createDebugLabel(scene: Phaser.Scene, root: Terrain4Root): Phaser.GameObjects.Text {
  const label = scene.add.text(0, 0, "", {
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: "12px",
    stroke: "#000000",
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(TERRAIN_DEPTH + 1);
  root.debugLabels.push(label);
  return label;
}

const screenProjection: Terrain4ScreenProjection = {
  project: ({ x, y, z }) => ({
    x: x * SCREEN_TILE_PX,
    y: y * SCREEN_TILE_PX - z * SCREEN_TILE_PX,
  }),
};

function materialsFor(world: World, bounds: Terrain4Rect) {
  const biome = worldBiomeAt(world, bounds.x, bounds.y);
  const palette = BIOME_MATERIALS[biome];
  return {
    floor: { color: palette.floor },
    void: { color: 0x000000 },
    southFace: { color: palette.face },
  };
}

function worldBiomeAt(world: World, x: number, y: number): BiomeKind {
  return biomeAtWorldTile(world.worldSeed, world.floor, x, y).biome;
}

function worldBoundsForView(view: ViewRect, orientation: ViewOrientation): Terrain4Rect {
  const minVX = Math.floor(view.x / SCREEN_TILE_PX) - VIEW_MARGIN_TILES;
  const minVY = Math.floor(view.y / SCREEN_TILE_PX) - VIEW_MARGIN_TILES;
  const maxVX = Math.ceil((view.x + view.width) / SCREEN_TILE_PX) + VIEW_MARGIN_TILES;
  const maxVY = Math.ceil((view.y + view.height) / SCREEN_TILE_PX) + VIEW_MARGIN_TILES;
  const corners = [
    viewTileToWorld({ x: minVX, y: minVY }, orientation),
    viewTileToWorld({ x: maxVX, y: minVY }, orientation),
    viewTileToWorld({ x: minVX, y: maxVY }, orientation),
    viewTileToWorld({ x: maxVX, y: maxVY }, orientation),
  ];
  const minX = Math.min(...corners.map((corner) => corner.x)) - VIEW_MARGIN_TILES;
  const minY = Math.min(...corners.map((corner) => corner.y)) - VIEW_MARGIN_TILES;
  const maxX = Math.max(...corners.map((corner) => corner.x)) + VIEW_MARGIN_TILES;
  const maxY = Math.max(...corners.map((corner) => corner.y)) + VIEW_MARGIN_TILES;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
