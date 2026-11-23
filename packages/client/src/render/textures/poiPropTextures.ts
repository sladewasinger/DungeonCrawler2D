/** Pixel-art structural prop textures for Overworld POIs (palisades, tents, ruin pillars). */
import { PropKind } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { makeOutlinedTexture } from "./fxPropTextures.js";
import { getLoadedSpriteAsset } from "./spriteManifest.js";

const WOOD_DK = "#5c3419";
const WOOD_MD = "#7c4722";
const WOOD_LT = "#a16232";
const BAND_IRON = "#475569";

export interface PoiPropSpriteSpec {
  readonly scale: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

const POI_SPRITE_KEYS: Partial<Readonly<Record<PropKind, string>>> = {
  [PropKind.Palisade]: "palisade",
  [PropKind.Tent]: "bandit-tent",
  [PropKind.RuinPillar]: "ruin-pillar",
};

export function getPoiPropSpriteSpec(kind: PropKind): PoiPropSpriteSpec | null {
  const key = POI_SPRITE_KEYS[kind];
  const asset = key ? getLoadedSpriteAsset(key) : null;
  return asset ? { scale: asset.scale, anchorX: asset.anchorX, anchorY: asset.anchorY } : null;
}

export function makePalisadeTexture(): Texture {
  const loaded = getLoadedSpriteAsset("palisade");
  if (loaded) return loaded.texture;
  return makeOutlinedTexture(18, 26, [
    [3, 7, 4, 16, WOOD_DK], [7, 5, 4, 18, WOOD_MD], [11, 7, 4, 16, WOOD_DK],
    [4, 8, 2, 13, WOOD_LT], [8, 6, 2, 14, WOOD_LT], [12, 8, 2, 13, WOOD_LT],
    [3, 14, 12, 2, BAND_IRON], [3, 19, 12, 2, BAND_IRON],
  ]);
}

export function makeTentTexture(): Texture {
  const loaded = getLoadedSpriteAsset("bandit-tent");
  if (loaded) return loaded.texture;
  return makeOutlinedTexture(34, 28, [
    [15, 4, 4, 3, "#a16207"],
    [9, 7, 16, 6, "#991b1b"], [5, 13, 24, 11, "#7f1d1d"],
    [11, 8, 12, 5, "#dc2626"], [7, 13, 20, 10, "#b91c1c"],
    [13, 15, 8, 9, "#1c1917"], [15, 16, 4, 8, "#0c0a09"],
    [5, 23, 24, 2, WOOD_DK],
  ]);
}

export function makeRuinPillarTexture(): Texture {
  const loaded = getLoadedSpriteAsset("ruin-pillar");
  if (loaded) return loaded.texture;
  return makeOutlinedTexture(20, 28, [
    [4, 21, 12, 4, "#3f4756"], [6, 9, 8, 13, "#64748b"],
    [7, 10, 4, 11, "#94a3b8"], [5, 5, 10, 5, "#64748b"],
    [6, 5, 5, 2, "#cbd5e1"], [10, 11, 4, 5, "#3f7d3a"],
    [5, 17, 4, 4, "#4e9647"],
  ]);
}
