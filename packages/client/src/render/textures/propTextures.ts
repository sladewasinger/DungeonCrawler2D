/** Zero-mixel 3x HD-pixel (48 px/tile) world prop texture atlas with bold Borderlands outlines. */
import { PropKind } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { createCampPropTextures, type CampPropTextures } from "../survival/campPropTextures.js";
import { createBiomePropTextures, type BiomePropTextures } from "./biomes/biomePropTextures.js";
import { createBiomePoiTextures, type BiomePoiTextures } from "./pois/biomePoiTextures.js";
import {
  makeHdBushVariants, makeHdOakCanopyTexture, makeHdOakTrunkTexture,
  makeHdPineCanopyTexture, makeHdPineTrunkTexture, makeHdTallGrassVariants, makeHdWildflowerVariants,
} from "./hd/hdFoliageTextures.js";
import { makeHdCampfireFrames, makeHdTorchFrames } from "./hd/hdFireTextures.js";
import {
  makeHdBoulderVariants, makeHdFallbackPalisadeTexture,
  makeHdFallbackRuinPillarTexture, makeHdFallbackTentTexture, makeHdStumpTexture,
} from "./hd/hdPropTextures.js";
import { makePalisadeTexture, makeRuinPillarTexture, makeTentTexture } from "./poiPropTextures.js";
import { getLoadedSpriteAsset } from "./spriteManifest.js";

/** Scale mapping 48 px/tile HD props cleanly to 16 px/tile world space (zero mixels). */
export const HD_PROP_SCALE = 1 / 3;

export interface PropTextureSet extends CampPropTextures, BiomePropTextures, BiomePoiTextures {
  readonly oakTrunk: Texture;
  readonly oakCanopy: Texture;
  readonly pineTrunk: Texture;
  readonly pineCanopy: Texture;
  readonly bush: readonly Texture[];
  readonly tallGrass: readonly Texture[];
  readonly boulder: readonly Texture[];
  readonly wildflower: readonly Texture[];
  readonly stump: Texture;
  readonly campfireFrames: readonly Texture[];
  readonly torchFrames: readonly Texture[];
  readonly palisade: Texture;
  readonly tent: Texture;
  readonly ruinPillar: Texture;
}

function pickPoiOrHdFallback(assetKey: string, pngFn: () => Texture, hdFn: () => Texture): Texture {
  return getLoadedSpriteAsset(assetKey) ? pngFn() : hdFn();
}

export function createPropTextureSet(): PropTextureSet {
  return {
    oakTrunk: makeHdOakTrunkTexture(),
    oakCanopy: makeHdOakCanopyTexture(),
    pineTrunk: makeHdPineTrunkTexture(),
    pineCanopy: makeHdPineCanopyTexture(),
    bush: makeHdBushVariants(),
    tallGrass: makeHdTallGrassVariants(),
    boulder: makeHdBoulderVariants(),
    wildflower: makeHdWildflowerVariants(),
    stump: makeHdStumpTexture(),
    campfireFrames: makeHdCampfireFrames(),
    torchFrames: makeHdTorchFrames(),
    palisade: pickPoiOrHdFallback("palisade", makePalisadeTexture, makeHdFallbackPalisadeTexture),
    tent: pickPoiOrHdFallback("bandit-tent", makeTentTexture, makeHdFallbackTentTexture),
    ruinPillar: pickPoiOrHdFallback("ruin-pillar", makeRuinPillarTexture, makeHdFallbackRuinPillarTexture),
    ...createCampPropTextures(),
    ...createBiomePropTextures(),
    ...createBiomePoiTextures(),
  };
}

export function isTreeProp(kind: PropKind): boolean {
  return kind === PropKind.OakTree || kind === PropKind.PineTree || kind === PropKind.BirchTree || kind === PropKind.MapleTree;
}
