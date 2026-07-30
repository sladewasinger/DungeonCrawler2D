// Central list of static asset paths under public/assets, so loaders never hardcode strings twice.
import { BUILD_SHA } from "../buildInfo.js";

export function buildAssetPath(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}build=${encodeURIComponent(BUILD_SHA)}`;
}

export const ASSET_KEYS = {
  atlas: "atlas",
  particleAtlas: "particle-atlas",
  animations: "animations-data",
  debugAtlas: "debug-atlas",
  sharedAtlas: "shared-atlas",
  spawnRoomMegaphone: "spawn-room-megaphone",
  arenaGate: "arena-gate",
} as const;

export const ASSET_PATHS = {
  atlasImage: buildAssetPath("assets/atlas.png"),
  atlasJson: buildAssetPath("assets/atlas.json"),
  particleAtlasImage: buildAssetPath("assets/particles/particle-atlas.png"),
  particleAtlasJson: buildAssetPath("assets/particles/particle-atlas.json"),
  animationsJson: buildAssetPath("assets/animations.json"),
  debugAtlasImage: buildAssetPath("assets/terrain/debug-atlas.png"),
  sharedAtlasImage: buildAssetPath("assets/terrain/shared-atlas.png"),
  spawnRoomMegaphoneImage: buildAssetPath("assets/props/spawn-room-megaphone.png"),
  arenaGateImage: buildAssetPath("assets/props/arena-gate.png"),
  fontFile: buildAssetPath("assets/fonts/monogram.ttf"),
} as const;

/** 0x72 source art is 16 px; VISUAL_DIRECTION requires integer ×3 on-screen scale. */
export const WORLD_PIXEL_SCALE = 3;
export const SOURCE_TILE_PX = 16;
export const SCREEN_TILE_PX = SOURCE_TILE_PX * WORLD_PIXEL_SCALE;
