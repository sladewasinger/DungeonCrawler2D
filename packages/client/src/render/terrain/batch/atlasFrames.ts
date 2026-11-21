import type Phaser from "phaser";
import {
  terrainAtlasFrame,
  TERRAIN_TILE_ROLES,
  type TerrainAtlasSet,
} from "../planning/tileset.js";

const NEAREST_FILTER = 1 as Phaser.Textures.FilterMode;

export function installTerrainAtlasFrames(
  textures: Phaser.Textures.TextureManager,
  set: TerrainAtlasSet,
): void {
  const { texture, source } = atlasTexture(textures, set);
  texture.setFilter(NEAREST_FILTER);
  for (const role of TERRAIN_TILE_ROLES) {
    for (let variant = 0; variant < set.rowCount; variant += 1) {
      addFrame(texture, terrainAtlasFrame({ set, role, variant, image: source }));
    }
  }
}

function atlasTexture(
  textures: Phaser.Textures.TextureManager,
  set: TerrainAtlasSet,
): { readonly texture: Phaser.Textures.Texture; readonly source: Phaser.Textures.TextureSource } {
  if (!textures.exists(set.key)) throw new Error(`Terrain atlas is not loaded: ${set.key}`);
  const texture = textures.get(set.key);
  const source = texture.source[0];
  if (!source) throw new Error(`Terrain atlas has no image source: ${set.key}`);
  return { texture, source };
}

function addFrame(
  texture: Phaser.Textures.Texture,
  frame: { readonly name: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): void {
  if (!texture.has(frame.name)) texture.add(frame.name, 0, frame.x, frame.y, frame.width, frame.height);
}
