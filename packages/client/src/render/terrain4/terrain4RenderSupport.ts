import { BIOME, biomeAtWorldTile, type BiomeKind, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import type { ViewRect } from "../terrain/streaming.js";
import { viewTileToWorld } from "../view/viewTransform.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import type { Terrain4ScreenProjection } from "./phaser4QuadBatch.js";
import type { Terrain4Batches, Terrain4Rect } from "./terrainPlanner.js";

export const VIEW_MARGIN_TILES = 2;
export const TERRAIN_DEPTH = -1000;

export const screenProjection: Terrain4ScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * SCREEN_TILE_PX, y: y * SCREEN_TILE_PX - z * SCREEN_TILE_PX }),
};

const BIOME_MATERIALS: Readonly<Record<BiomeKind, { floor: number; face: number }>> = {
  [BIOME.Maze]: { floor: 0x526579, face: 0x2d3c4d },
  [BIOME.OpenHalls]: { floor: 0xb28a52, face: 0x6e4d2d },
  [BIOME.Ruins]: { floor: 0x68715b, face: 0x3c4536 },
  [BIOME.Pillars]: { floor: 0x687458, face: 0x3a4537 },
  [BIOME.Pools]: { floor: 0x3c91aa, face: 0x20536c },
  [BIOME.Arena]: { floor: 0x9d5b43, face: 0x5b2c2a },
};

export interface Terrain4DebugHost {
  readonly debugLabels: Phaser.GameObjects.Text[];
}

const DEBUG_LABELS: Readonly<Record<"floor" | "void" | "feature" | "south-face", string>> = {
  floor: "F", void: "V", feature: "FT", "south-face": "WF",
};

export function materialsFor(world: World, bounds: Terrain4Rect) {
  const palette = BIOME_MATERIALS[worldBiomeAt(world, bounds.x, bounds.y)];
  return { floor: { color: palette.floor }, feature: { color: palette.floor }, void: { color: 0x000000 }, southFace: { color: palette.face } };
}

export function worldBiomeAt(world: World, x: number, y: number): BiomeKind {
  return biomeAtWorldTile(world.worldSeed, world.floor, x, y).biome;
}

export function worldBoundsForView(view: ViewRect, orientation: ViewOrientation): Terrain4Rect {
  const minVX = Math.floor(view.x / SCREEN_TILE_PX) - VIEW_MARGIN_TILES;
  const minVY = Math.floor(view.y / SCREEN_TILE_PX) - VIEW_MARGIN_TILES;
  const maxVX = Math.ceil((view.x + view.width) / SCREEN_TILE_PX) + VIEW_MARGIN_TILES;
  const maxVY = Math.ceil((view.y + view.height) / SCREEN_TILE_PX) + VIEW_MARGIN_TILES;
  const corners = [
    viewTileToWorld({ x: minVX, y: minVY }, orientation), viewTileToWorld({ x: maxVX, y: minVY }, orientation),
    viewTileToWorld({ x: minVX, y: maxVY }, orientation), viewTileToWorld({ x: maxVX, y: maxVY }, orientation),
  ];
  const minX = Math.min(...corners.map((corner) => corner.x)) - VIEW_MARGIN_TILES;
  const minY = Math.min(...corners.map((corner) => corner.y)) - VIEW_MARGIN_TILES;
  const maxX = Math.max(...corners.map((corner) => corner.x)) + VIEW_MARGIN_TILES;
  const maxY = Math.max(...corners.map((corner) => corner.y)) + VIEW_MARGIN_TILES;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function renderDebugLabels(
  scene: Phaser.Scene,
  root: Terrain4DebugHost,
  plan: Terrain4Batches,
  visible: boolean,
): void {
  const entries = [...plan.floors, ...plan.voids, ...plan.features, ...plan.southFaces];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    const label = root.debugLabels[index] ?? createDebugLabel(scene, root);
    const center = entry.vertices.reduce((sum, vertex) => ({
      x: sum.x + vertex.x / 4, y: sum.y + vertex.y / 4, z: sum.z + vertex.z / 4,
    }), { x: 0, y: 0, z: 0 });
    const screen = screenProjection.project(center);
    label.setText(DEBUG_LABELS[entry.kind]).setPosition(screen.x, screen.y).setVisible(visible);
  }
  for (let index = entries.length; index < root.debugLabels.length; index++) root.debugLabels[index]?.setVisible(false);
}

function createDebugLabel(scene: Phaser.Scene, root: Terrain4DebugHost): Phaser.GameObjects.Text {
  const label = scene.add.text(0, 0, "", {
    color: "#ffffff", fontFamily: "monospace", fontSize: "12px", stroke: "#000000", strokeThickness: 3,
  }).setOrigin(0.5).setDepth(TERRAIN_DEPTH + 1);
  root.debugLabels.push(label);
  return label;
}
