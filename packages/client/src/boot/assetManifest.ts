// Central list of static asset paths under public/assets, so loaders never hardcode strings twice.

export const ASSET_KEYS = {
  atlas: "atlas",
  animations: "animations-data",
} as const;

export const ASSET_PATHS = {
  atlasImage: "assets/atlas.png",
  atlasJson: "assets/atlas.json",
  animationsJson: "assets/animations.json",
  fontFile: "assets/fonts/monogram.ttf",
} as const;

// Debug tileset (autotile-debug lane): frame layout lives in
// render/terrain/debugTileset.ts, which owns DEBUG_TILESET_KEY/PATH/TILE_PX too —
// re-exported here isn't needed since PreloadScene imports straight from there.

/** 0x72 source art is 16 px; VISUAL_DIRECTION requires integer ×3 on-screen scale. */
export const WORLD_PIXEL_SCALE = 3;
export const SOURCE_TILE_PX = 16;
export const SCREEN_TILE_PX = SOURCE_TILE_PX * WORLD_PIXEL_SCALE;
