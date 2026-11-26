/** Zero-mixel 3x HD-pixel (48 px/tile) world prop texture atlas with bold Borderlands outlines. */
import { PropKind, type ChunkProp } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import { createCampPropTextures, type CampPropTextures } from "../survival/campPropTextures.js";
import { createBiomePropTextures, type BiomePropTextures } from "./biomes/biomePropTextures.js";
import { createBiomePoiTextures, type BiomePoiTextures } from "./pois/biomePoiTextures.js";
import { createSafeRoomPropTextures, type SafeRoomPropTextures } from "./pois/safeRoomTextures.js";
import {
  makeHdBushVariants, makeHdOakCanopyTexture, makeHdOakTrunkTexture,
  makeHdPineCanopyTexture, makeHdPineTrunkTexture, makeHdTallGrassVariants, makeHdWildflowerVariants,
} from "./hd/hdFoliageTextures.js";
import { makeHdCampfireFrames, makeHdTorchFrames } from "./hd/hdFireTextures.js";
import {
  makeHdBoulderVariants, makeHdFallbackRuinPillarTexture, makeHdFallbackTentTexture, makeHdStumpTexture,
} from "./hd/hdPropTextures.js";
import { makePalisadeTexture, makeRuinPillarTexture, makeTentTexture } from "./poiPropTextures.js";
import { getLoadedSpriteAsset } from "./spriteManifest.js";

/** Scale mapping 48 px/tile HD props cleanly to 16 px/tile world space (zero mixels). */
export const HD_PROP_SCALE = 1 / 3;

export interface PropTextureSet extends CampPropTextures, BiomePropTextures, BiomePoiTextures, SafeRoomPropTextures {
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
  readonly tent: Texture;
  readonly ruinPillar: Texture;
}

function pickPoiOrHdFallback(assetKey: string, pngFn: () => Texture, hdFn: () => Texture): Texture {
  return getLoadedSpriteAsset(assetKey) ? pngFn() : hdFn();
}

export function createPropTextureSet(): PropTextureSet {
  const camp = createCampPropTextures();
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
    ...camp,
    palisade: pickPoiOrHdFallback("palisade", makePalisadeTexture, () => camp.palisade),
    tent: pickPoiOrHdFallback("bandit-tent", makeTentTexture, makeHdFallbackTentTexture),
    ruinPillar: pickPoiOrHdFallback("ruin-pillar", makeRuinPillarTexture, makeHdFallbackRuinPillarTexture),
    ...createBiomePropTextures(),
    ...createBiomePoiTextures(),
    ...createSafeRoomPropTextures(),
  };
}

export function isTreeProp(kind: PropKind): boolean {
  return kind === PropKind.OakTree || kind === PropKind.PineTree || kind === PropKind.BirchTree || kind === PropKind.MapleTree;
}

const PROP_TEX_BY_KIND: Partial<Record<PropKind, (p: PropTextureSet, v: number) => Texture>> = {
  [PropKind.Boulder]: (p, v) => p.boulder[v % p.boulder.length]!,
  [PropKind.Bush]: (p, v) => p.bush[v % p.bush.length]!,
  [PropKind.Campfire]: (p) => p.campfireFrames[0]!,
  [PropKind.Torch]: (p) => p.torchFrames[0]!,
  [PropKind.Palisade]: (p) => p.palisade,
  [PropKind.Tent]: (p) => p.tent,
  [PropKind.RuinPillar]: (p) => p.ruinPillar,
  [PropKind.CopperVein]: (p) => p.copperVein,
  [PropKind.IronVein]: (p) => p.ironVein,
  [PropKind.Workbench]: (p) => p.workbench,
  [PropKind.Bed]: (p) => p.bed,
  [PropKind.DeadTree]: (p) => p.deadTree,
  [PropKind.GiantMushroom]: (p) => p.giantMushroom,
  [PropKind.BogReed]: (p) => p.bogReed,
  [PropKind.CursedCrystal]: (p) => p.cursedCrystal,
  [PropKind.ShrineAltar]: (p) => p.shrineAltar,
  [PropKind.Waystone]: (p) => p.waystone,
  [PropKind.Gravestone]: (p) => p.gravestone,
  [PropKind.BrokenCart]: (p) => p.brokenCart,
  [PropKind.GreatStump]: (p) => p.greatStump,
  [PropKind.SunkenBoat]: (p) => p.sunkenBoat,
  [PropKind.LoreSign]: (p) => p.loreSign,
  [PropKind.BoneTotem]: (p) => p.boneTotem,
  [PropKind.RunicForge]: (p) => p.runicForge,
  [PropKind.CursedObelisk]: (p) => p.cursedObelisk,
  [PropKind.BrazierUnlit]: (p) => p.brazierUnlit,
  [PropKind.BrazierLit]: (p) => p.brazierLit,
  [PropKind.HermitHut]: (p) => p.hermitHut,
  [PropKind.FairyRing]: (p) => p.fairyRing,
  [PropKind.StashChest]: (p) => p.stashChest,
  [PropKind.BountyBoard]: (p) => p.bountyBoard,
  [PropKind.NpcGuide]: (p) => p.npcGuide,
  [PropKind.NpcMerchant]: (p) => p.npcMerchant,
  [PropKind.NpcBlacksmith]: (p) => p.npcBlacksmith,
};

const TREE_TEXTURES: Partial<Record<PropKind, (p: PropTextureSet) => readonly [Texture, Texture]>> = {
  [PropKind.PineTree]: (p) => [p.pineTrunk, p.pineCanopy],
  [PropKind.BirchTree]: (p) => [p.birchTrunk, p.birchCanopy],
  [PropKind.MapleTree]: (p) => [p.mapleTrunk, p.mapleCanopy],
};

export const REGISTERED_PROP_RENDER_KINDS: readonly PropKind[] = [
  ...(Object.keys(PROP_TEX_BY_KIND) as PropKind[]),
  ...(Object.keys(TREE_TEXTURES) as PropKind[]),
  PropKind.OakTree, PropKind.Stump, PropKind.TallGrass, PropKind.Wildflower, PropKind.WoodChest,
];

export function resolvePropTexture(prop: ChunkProp, p: PropTextureSet): Texture {
  if (prop.kind === PropKind.Bush && prop.depleted) return p.bushStripped;
  return PROP_TEX_BY_KIND[prop.kind]?.(p, prop.variant) ?? p.stump;
}

export function resolveTreeTextures(kind: PropKind, p: PropTextureSet): readonly [Texture, Texture] {
  return TREE_TEXTURES[kind]?.(p) ?? [p.oakTrunk, p.oakCanopy];
}
