/** Pixel-art vegetation and rock prop texture builders. */
import { PropKind } from "@dc2d/engine";
import type { Texture } from "pixi.js";
import {
  makeCampfireFrames,
  makeCustomOutlinedTexture,
  makeFallbackKnight,
  makeOutlinedTexture,
  makeTorchFrames,
} from "./fxPropTextures.js";

export interface PropTextureSet {
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
  readonly fallbackKnight: Texture;
}

const LEAF_DARK = "#1f5a2e";
const LEAF_MID = "#2f7d3d";
const LEAF_LIGHT = "#52ab4d";
const LEAF_SUN = "#7ed462";
const PINE_DARK = "#1a4a2b";
const PINE_MID = "#25663b";
const PINE_LIGHT = "#3c8c4c";

function makeOakCanopy(): Texture {
  return makeOutlinedTexture(48, 44, [
    [10, 8, 28, 28, LEAF_DARK], [6, 14, 36, 18, LEAF_DARK], [9, 10, 30, 22, LEAF_MID],
    [14, 5, 20, 22, LEAF_MID], [12, 8, 12, 11, LEAF_LIGHT], [24, 10, 12, 10, LEAF_LIGHT],
    [15, 6, 8, 6, LEAF_SUN], [26, 11, 7, 5, LEAF_SUN], [16, 20, 14, 8, LEAF_LIGHT],
  ]);
}

function makePineCanopy(): Texture {
  return makeOutlinedTexture(38, 46, [
    [16, 3, 6, 6, PINE_MID], [12, 9, 14, 8, PINE_DARK], [14, 8, 10, 6, PINE_LIGHT],
    [8, 16, 22, 10, PINE_DARK], [11, 16, 16, 7, PINE_MID], [13, 15, 10, 4, PINE_LIGHT],
    [4, 25, 30, 13, PINE_DARK], [7, 25, 24, 9, PINE_MID], [11, 24, 14, 5, PINE_LIGHT],
  ]);
}

function makeBushVariants(): readonly Texture[] {
  const tints = [["#f43f5e", "#fda4af"], ["#38bdf8", "#bae6fd"], [LEAF_SUN, LEAF_SUN]] as const;
  return tints.map(([berry, glint]) =>
    makeOutlinedTexture(22, 18, [
      [3, 5, 16, 10, LEAF_DARK], [4, 3, 14, 10, LEAF_MID], [6, 4, 8, 5, LEAF_LIGHT],
      [7, 8, 2, 2, berry], [13, 7, 2, 2, berry], [11, 11, 2, 2, glint],
    ]),
  );
}

function makeTallGrassVariants(): readonly Texture[] {
  const softOutline: readonly [number, number, number] = [26, 68, 30];
  return [0, 1, 2].map((v) =>
    makeCustomOutlinedTexture({ w: 16, h: 16, outline: softOutline }, [
      [3 + v, 8, 2, 7, LEAF_MID], [4 + v, 5, 1, 4, LEAF_SUN], [7, 7, 2, 8, LEAF_DARK],
      [8, 4, 2, 6, LEAF_LIGHT], [11 - v, 8, 2, 7, LEAF_MID], [12 - v, 6, 1, 4, LEAF_SUN],
    ]),
  );
}

function makeBoulderVariants(): readonly Texture[] {
  return [0, 1, 2].map((v) =>
    makeOutlinedTexture(24, 20, [
      [4, 6 + (v % 2), 16, 11, "#525b69"], [6, 4, 12, 10, "#758193"], [7, 5, 7, 4, "#9ca8ba"],
      [5, 13, 14, 4, "#3b424d"], [6, 7, 4, 3, "#497d42"],
    ]),
  );
}

function makeWildflowerVariants(): readonly Texture[] {
  const colors = ["#fde047", "#c084fc", "#fb7185"] as const;
  const softOutline: readonly [number, number, number] = [26, 68, 30];
  return colors.map((petal) =>
    makeCustomOutlinedTexture({ w: 14, h: 14, outline: softOutline }, [
      [4, 7, 1, 5, LEAF_MID], [9, 6, 1, 6, LEAF_MID], [3, 5, 3, 3, petal],
      [4, 6, 1, 1, "#fef9c3"], [8, 4, 3, 3, petal], [9, 5, 1, 1, "#ffffff"],
    ]),
  );
}

export function createPropTextureSet(): PropTextureSet {
  return {
    oakTrunk: makeOutlinedTexture(20, 20, [
      [7, 3, 6, 13, "#6b4226"], [8, 3, 3, 12, "#875735"], [6, 14, 8, 3, "#54321c"], [5, 16, 10, 2, "#3d2414"],
    ]),
    oakCanopy: makeOakCanopy(),
    pineTrunk: makeOutlinedTexture(16, 18, [
      [6, 4, 4, 12, "#593520"], [7, 4, 2, 11, "#78492d"], [5, 15, 6, 2, "#402415"],
    ]),
    pineCanopy: makePineCanopy(),
    bush: makeBushVariants(),
    tallGrass: makeTallGrassVariants(),
    boulder: makeBoulderVariants(),
    wildflower: makeWildflowerVariants(),
    stump: makeOutlinedTexture(18, 16, [
      [5, 5, 8, 8, "#6b4226"], [6, 4, 6, 3, "#c49a6c"], [4, 11, 10, 3, "#4d2f1a"], [4, 8, 3, 3, "#3f7d3a"],
    ]),
    campfireFrames: makeCampfireFrames(),
    torchFrames: makeTorchFrames(),
    fallbackKnight: makeFallbackKnight(),
  };
}

export function isTreeProp(kind: PropKind): boolean {
  return kind === PropKind.OakTree || kind === PropKind.PineTree;
}
