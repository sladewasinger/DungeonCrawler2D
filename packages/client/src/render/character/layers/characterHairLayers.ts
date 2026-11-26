/** Modular 32x32 4-directional hair layers: styled short, flowing long, unclipped spiky, and high ponytail. */
import { HAIR_PALETTES, type ToneTriad } from "@dc2d/content";
import type { CharacterAppearance, HairStyleId } from "@dc2d/engine";
import type { PixelRect } from "../../textures/pixelCanvas.js";
import { BELT_DARK, type CharacterPose, type FacingDir } from "../characterTypes.js";

interface HairBuildCtx {
  readonly pal: ToneTriad;
  readonly style: HairStyleId;
  readonly dir: FacingDir;
  readonly b: number;
  readonly hy: number;
  readonly sway: number;
  readonly hooded: boolean;
}

function sideBaseCrown(pal: ToneTriad, b: number): PixelRect[] {
  return [
    [12, 3 + b, 8, 2, pal.base], [10, 4 + b, 10, 5, pal.base], [10, 8 + b, 5, 4, pal.base],
    [13, 4 + b, 5, 1, pal.highlight], [15, 5 + b, 3, 1, pal.highlight],
    [18, 5 + b, 3, 2, pal.base], [20, 6 + b, 1, 2, pal.base], [15, 7 + b, 2, 3, pal.base],
    [14, 9 + b, 1, 2, pal.shade], [10, 10 + b, 3, 2, pal.shade],
  ];
}

function hoodedBangs(dir: FacingDir, b: number, pal: ToneTriad): PixelRect[] {
  if (dir === "north") return [];
  if (dir === "side") return [[17, 6 + b, 3, 2, pal.highlight]];
  return [[12, 6 + b, 8, 2, pal.base], [13, 6 + b, 5, 1, pal.highlight]];
}

function buildShortHair(c: HairBuildCtx): PixelRect[] {
  const { pal, dir, b, hooded } = c;
  if (hooded) return hoodedBangs(dir, b, pal);
  if (dir === "north") {
    return [
      [12, 2 + b, 7, 1, pal.base], [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 6, pal.base],
      [11, 10 + b, 10, 2, pal.base], [12, 12 + b, 8, 1, pal.shade],
      [13, 3 + b, 5, 1, pal.highlight], [12, 4 + b, 3, 1, pal.highlight], [13, 9 + b, 1, 3, pal.shade], [18, 9 + b, 1, 3, pal.shade],
    ];
  }
  if (dir === "side") {
    return [
      [14, 2 + b, 4, 1, pal.base], [12, 3 + b, 8, 2, pal.base], [10, 4 + b, 10, 5, pal.base],
      [10, 9 + b, 4, 2, pal.base], [11, 11 + b, 3, 1, pal.shade], [13, 4 + b, 5, 1, pal.highlight],
      [15, 5 + b, 3, 1, pal.highlight], [18, 5 + b, 3, 2, pal.base], [20, 6 + b, 1, 2, pal.base], [15, 7 + b, 1, 3, pal.base],
    ];
  }
  return [
    [13, 2 + b, 5, 1, pal.base], [11, 3 + b, 9, 2, pal.base], [10, 4 + b, 12, 2, pal.base],
    [12, 3 + b, 4, 1, pal.highlight], [15, 4 + b, 3, 1, pal.highlight],
    [10, 6 + b, 4, 1, pal.base], [12, 6 + b, 3, 2, pal.base], [15, 6 + b, 2, 1, pal.highlight],
    [18, 6 + b, 4, 1, pal.base], [19, 7 + b, 2, 1, pal.base], [10, 7 + b, 1, 2, pal.shade], [21, 7 + b, 1, 2, pal.shade],
  ];
}

function buildLongSouth(c: HairBuildCtx): PixelRect[] {
  const { pal, b, hy, hooded } = c;
  if (hooded) {
    return [
      [12, 6 + b, 8, 2, pal.base], [13, 6 + b, 5, 1, pal.highlight],
      [9, 12 + hy, 2, 5, pal.base], [21, 12 + hy, 2, 5, pal.base],
    ];
  }
  return [
    [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 2, pal.base], [12, 3 + b, 4, 1, pal.highlight], [17, 4 + b, 3, 1, pal.highlight],
    [10, 6 + b, 4, 2, pal.base], [18, 6 + b, 4, 2, pal.base], [14, 6 + b, 1, 1, pal.highlight],
    [9, 6 + b, 2, 6, pal.base], [8, 10 + hy, 3, 6, pal.base], [9, 11 + hy, 1, 3, pal.highlight], [10, 12 + hy, 1, 5, pal.shade], [9, 16 + hy, 2, 2, pal.base],
    [21, 6 + b, 2, 6, pal.base], [21, 10 + hy, 3, 6, pal.base], [22, 11 + hy, 1, 3, pal.highlight], [21, 12 + hy, 1, 5, pal.shade], [21, 16 + hy, 2, 2, pal.base],
  ];
}

function buildLongHair(c: HairBuildCtx): PixelRect[] {
  const { pal, dir, b, hy, sway, hooded } = c;
  if (dir === "south") return buildLongSouth(c);
  if (dir === "north") {
    return hooded ? [] : [
      [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 8, pal.base], [9 + sway, 10 + hy, 14, 7, pal.base], [10 + sway, 17 + hy, 12, 2, pal.base],
      [11 + sway, 19 + hy, 4, 1, pal.shade], [17 + sway, 19 + hy, 4, 1, pal.shade],
      [12, 4 + b, 7, 1, pal.highlight], [11 + sway, 11 + hy, 10, 1, pal.highlight], [13 + sway, 12 + hy, 6, 1, pal.highlight],
      [13 + sway, 13 + hy, 1, 5, pal.shade], [18 + sway, 13 + hy, 1, 5, pal.shade], [9 + sway, 14 + hy, 1, 3, pal.shade], [22 + sway, 14 + hy, 1, 3, pal.shade],
    ];
  }
  if (hooded) return [[10, 12 + hy, 3, 6, pal.base], [10, 17 + hy, 2, 2, pal.shade]];
  return [
    ...sideBaseCrown(pal, b),
    [8, 7 + hy, 6, 8, pal.base], [7, 12 + hy, 6, 5, pal.base], [8, 17 + hy, 4, 2, pal.base], [9, 19 + hy, 2, 1, pal.shade],
    [9, 8 + hy, 2, 4, pal.highlight], [8, 13 + hy, 2, 3, pal.highlight], [12, 11 + hy, 2, 5, pal.shade], [7, 16 + hy, 1, 2, pal.shade],
  ];
}

function buildSpikyHair(c: HairBuildCtx): PixelRect[] {
  const { pal, dir, b, hy, hooded } = c;
  if (hooded) return hoodedBangs(dir, b, pal);
  if (dir === "north") {
    return [
      [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 7, pal.base], [11, 11 + b, 10, 2, pal.shade],
      [10, 2 + hy, 2, 2, pal.base], [15, 2 + hy, 2, 2, pal.highlight], [20, 2 + hy, 2, 2, pal.base], [14, 3 + b, 4, 2, pal.base],
    ];
  }
  if (dir === "side") {
    return [
      ...sideBaseCrown(pal, b),
      [10, 2 + hy, 2, 2, pal.base], [14, 2 + hy, 3, 2, pal.highlight], [18, 2 + hy, 2, 2, pal.base], [8, 5 + hy, 2, 2, pal.shade],
    ];
  }
  return [
    [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 2, pal.base],
    [10, 2 + hy, 2, 2, pal.base], [15, 2 + hy, 2, 2, pal.highlight], [20, 2 + hy, 2, 2, pal.base], [14, 3 + b, 4, 2, pal.base],
    [11, 6 + b, 2, 2, pal.base], [15, 6 + b, 2, 2, pal.highlight], [19, 6 + b, 2, 1, pal.base],
  ];
}

function buildPonytailHair(c: HairBuildCtx): PixelRect[] {
  const { pal, dir, b, hy, sway, hooded } = c;
  if (hooded) return hoodedBangs(dir, b, pal);
  if (dir === "north") {
    return [
      [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 6, pal.base], [11, 9 + b, 10, 2, pal.shade],
      [14, 2 + hy, 4, 2, pal.base], [13, 3 + hy, 6, 2, pal.highlight], [14, 5 + b, 4, 1, BELT_DARK],
      [12 + sway, 6 + hy, 8, 5, pal.shade], [13 + sway, 6 + hy, 6, 5, pal.base], [14 + sway, 6 + hy, 4, 3, pal.highlight],
      [13 + sway, 11 + hy, 6, 2, pal.shade], [14 + sway, 11 + hy, 4, 3, pal.base], [15 + sway, 14 + hy, 2, 2, pal.highlight],
    ];
  }
  if (dir === "side") {
    return [
      ...sideBaseCrown(pal, b), [9, 4 + b, 2, 2, BELT_DARK],
      [6, 2 + hy, 4, 3, pal.base], [6, 2 + hy, 3, 1, pal.highlight],
      [4, 4 + hy, 4, 4, pal.base], [5, 4 + hy, 2, 3, pal.highlight],
      [5, 7 + hy, 3, 2, pal.shade], [3, 7 + hy, 2, 3, pal.shade], [2, 9 + hy, 2, 2, pal.base],
    ];
  }
  return [
    [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 3, pal.base], [12, 4 + b, 6, 1, pal.highlight],
    [10, 6 + b, 2, 3, pal.shade], [20, 6 + b, 2, 2, pal.shade],
    [13, 2 + hy, 6, 2, pal.highlight], [8, 3 + hy, 3, 3, pal.highlight], [6, 5 + hy, 4, 4, pal.base], [5, 8 + hy, 3, 2, pal.shade],
  ];
}

const HAIR_BUILDERS: Readonly<Record<HairStyleId, (c: HairBuildCtx) => PixelRect[]>> = {
  short: buildShortHair,
  long: buildLongHair,
  spiky: buildSpikyHair,
  ponytail: buildPonytailHair,
  bald: () => [],
};

export function buildHairRects(input: {
  readonly appearance: CharacterAppearance;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
  readonly hooded: boolean;
}): PixelRect[] {
  const style = input.appearance.hairStyle;
  if (style === "bald") return [];
  const pal = HAIR_PALETTES[input.appearance.hairColor] ?? HAIR_PALETTES.brown!;
  return HAIR_BUILDERS[style]({
    pal, style, dir: input.dir, b: input.pose.bobY, hy: input.pose.hairBobY,
    sway: Math.sign(input.pose.stride), hooded: input.hooded,
  });
}
