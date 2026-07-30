import { BIOME, biomeAtWorldTile, type BiomeKind, type World } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { ViewRect } from "../../terrain/streaming/streaming.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { TerrainScreenProjection } from "../batch/quadBatch.js";
import {
  TERRAIN_PRESENTATION_MODES,
  type TerrainPresentationMode,
  type TerrainRect,
} from "../planning/terrainPlanner.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import type { TerrainVisualFeatures } from "../streaming/terrainDeviceProfile.js";

export const VIEW_MARGIN_TILES = 2;
export const TERRAIN_DEPTH = -1000;
export const TERRAIN_CAMERA_BACKGROUND = TERRAIN_VISUAL_STYLE.camera.background;

export function terrainCameraBackground(
  mode: TerrainPresentationMode,
): string {
  return mode === TERRAIN_PRESENTATION_MODES.Inside
    ? TERRAIN_VISUAL_STYLE.camera.insideBackground
    : TERRAIN_CAMERA_BACKGROUND;
}

export const screenProjection: TerrainScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * SCREEN_TILE_PX, y: y * SCREEN_TILE_PX - z * SCREEN_TILE_PX }),
};

const BIOME_MATERIALS: Readonly<Record<BiomeKind, { floor: number; face: number }>> = {
  [BIOME.Maze]: fallbackMaterial(BIOME.Maze),
  [BIOME.OpenHalls]: fallbackMaterial(BIOME.OpenHalls),
  [BIOME.Ruins]: fallbackMaterial(BIOME.Ruins),
  [BIOME.Pillars]: fallbackMaterial(BIOME.Pillars),
  [BIOME.Pools]: fallbackMaterial(BIOME.Pools),
  [BIOME.Arena]: fallbackMaterial(BIOME.Arena),
};

export function materialsFor(
  world: Partial<World>,
  bounds: TerrainRect,
  visuals: TerrainVisualFeatures,
) {
  const palette = BIOME_MATERIALS[worldBiomeAt(world, bounds.x, bounds.y)];
  return {
    floor: { color: palette.floor },
    bedrock: { color: phaserColor(TERRAIN_VISUAL_STYLE.bedrock.topColor) },
    feature: { color: palette.floor },
    void: { color: phaserColor(TERRAIN_VISUAL_STYLE.fallbackMaterials.void) },
    southFace: { color: palette.face }, cliffEdge: { color: palette.face },
    ao: visuals.ambientOcclusion ? {
      color: phaserColor(TERRAIN_VISUAL_STYLE.ambientOcclusion.color),
      alpha: TERRAIN_VISUAL_STYLE.ambientOcclusion.fallbackAlpha,
    } : null,
  };
}

function fallbackMaterial(biome: BiomeKind): { floor: number; face: number } {
  const material = TERRAIN_VISUAL_STYLE.fallbackMaterials.biomes[biome];
  return { floor: phaserColor(material.floor), face: phaserColor(material.wallFace) };
}

export function worldBiomeAt(world: Partial<World>, x: number, y: number): BiomeKind {
  if (world.worldSeed === undefined || world.floor === undefined) return BIOME.Maze;
  return biomeAtWorldTile({ worldSeed: world.worldSeed, floor: world.floor, wx: x, wy: y }).biome;
}

export function worldBoundsForView(
  view: ViewRect,
  orientation: ViewOrientation,
  marginTiles = VIEW_MARGIN_TILES,
): TerrainRect {
  const minVX = Math.floor(view.x / SCREEN_TILE_PX) - marginTiles;
  const minVY = Math.floor(view.y / SCREEN_TILE_PX) - marginTiles;
  const maxVX = Math.ceil((view.x + view.width) / SCREEN_TILE_PX) + marginTiles;
  const maxVY = Math.ceil((view.y + view.height) / SCREEN_TILE_PX) + marginTiles;
  const corners = [
    viewTileToWorld({ x: minVX, y: minVY }, orientation), viewTileToWorld({ x: maxVX, y: minVY }, orientation),
    viewTileToWorld({ x: minVX, y: maxVY }, orientation), viewTileToWorld({ x: maxVX, y: maxVY }, orientation),
  ];
  const minX = Math.min(...corners.map((corner) => corner.x)) - marginTiles;
  const minY = Math.min(...corners.map((corner) => corner.y)) - marginTiles;
  const maxX = Math.max(...corners.map((corner) => corner.x)) + marginTiles;
  const maxY = Math.max(...corners.map((corner) => corner.y)) + marginTiles;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
