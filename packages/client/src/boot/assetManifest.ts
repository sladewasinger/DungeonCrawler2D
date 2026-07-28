// Central list of static asset paths under public/assets, so loaders never hardcode strings twice.

export const ASSET_KEYS = {
  atlas: "atlas",
  particleAtlas: "particle-atlas",
  animations: "animations-data",
  debugAtlas: "debug-atlas",
  sharedAtlas: "shared-atlas",
} as const;

export const ASSET_PATHS = {
  atlasImage: "assets/atlas.png",
  atlasJson: "assets/atlas.json",
  particleAtlasImage: "assets/particles/particle-atlas.png",
  particleAtlasJson: "assets/particles/particle-atlas.json",
  animationsJson: "assets/animations.json",
  debugAtlasImage: "assets/terrain/debug-atlas.png",
  sharedAtlasImage: "assets/terrain/shared-atlas.png",
  fontFile: "assets/fonts/monogram.ttf",
} as const;

/** 0x72 source art is 16 px; VISUAL_DIRECTION requires integer ×3 on-screen scale. */
export const WORLD_PIXEL_SCALE = 3;
export const SOURCE_TILE_PX = 16;
export const SCREEN_TILE_PX = SOURCE_TILE_PX * WORLD_PIXEL_SCALE;
