/** Pixel-art structural prop textures for Overworld POIs (palisades, tents, ruin pillars). */
import { PropKind } from "@dc2d/engine";
import { Texture } from "pixi.js";
import { getLoadedSpriteAsset } from "./spriteManifest.js";

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
  return getLoadedSpriteAsset("palisade")?.texture ?? Texture.EMPTY;
}

export function makeTentTexture(): Texture {
  return getLoadedSpriteAsset("bandit-tent")?.texture ?? Texture.EMPTY;
}

export function makeRuinPillarTexture(): Texture {
  return getLoadedSpriteAsset("ruin-pillar")?.texture ?? Texture.EMPTY;
}
