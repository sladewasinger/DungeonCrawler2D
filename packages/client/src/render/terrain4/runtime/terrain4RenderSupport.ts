import { BIOME, biomeAtWorldTile, type BiomeKind, type World } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { Terrain4ScreenProjection } from "../batch/phaser4QuadBatch.js";
import type { Terrain4Rect } from "../planning/terrainPlanner.js";

export const VIEW_MARGIN_TILES = 2;
export const TERRAIN_DEPTH = -1000;
export const TERRAIN4_CAMERA_BACKGROUND = "#14141c";

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

export function materialsFor(world: Partial<World>, bounds: Terrain4Rect) {
  const palette = BIOME_MATERIALS[worldBiomeAt(world, bounds.x, bounds.y)];
  return {
    floor: { color: palette.floor }, feature: { color: palette.floor }, void: { color: 0x000000 },
    southFace: { color: palette.face }, cliffEdge: { color: palette.face }, ao: { color: 0x06060c, alpha: 0.22 },
  };
}

export function worldBiomeAt(world: Partial<World>, x: number, y: number): BiomeKind {
  if (world.worldSeed === undefined || world.floor === undefined) return BIOME.Maze;
  return biomeAtWorldTile({ worldSeed: world.worldSeed, floor: world.floor, wx: x, wy: y }).biome;
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
