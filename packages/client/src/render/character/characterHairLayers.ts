/** Modular 32x32 4-directional hair layers with follow-through bounce and hood tucking. */
import { HAIR_PALETTES, type ToneTriad } from "@dc2d/content";
import type { CharacterAppearance, HairStyleId } from "@dc2d/engine";
import type { PixelRect } from "../textures/pixelCanvas.js";
import { BELT_DARK, type CharacterPose, type FacingDir } from "./characterTypes.js";

function appendSouthStyleHair(out: PixelRect[], pal: ToneTriad, opts: {
  readonly style: HairStyleId; readonly b: number; readonly hb: number; readonly hooded: boolean;
}): void {
  const { style, b, hb, hooded } = opts;
  if (style === "long") {
    const startY = hooded ? 10 + b : 7 + b;
    out.push([9, startY, 2, 9 + hb, pal.shade], [21, startY, 2, 8 + hb, pal.base]);
    return;
  }
  if (hooded) return;
  if (style === "spiky") {
    out.push([10, 1 + b + hb, 3, 3, pal.base], [14, 0 + b + hb, 4, 4, pal.highlight], [19, 1 + b + hb, 3, 3, pal.base]);
  } else if (style === "ponytail") {
    out.push([13, 1 + b + hb, 6, 2, pal.highlight], [8, 3 + b + hb, 3, 3, pal.highlight], [6, 5 + b + hb, 4, 4, pal.base], [5, 8 + b + hb, 3, 2, pal.shade]);
  }
}

function southHair(pal: ToneTriad, style: HairStyleId, input: { readonly b: number; readonly hb: number; readonly hooded: boolean }): PixelRect[] {
  const { b, hb, hooded } = input;
  const out: PixelRect[] = hooded
    ? [[12, 6 + b, 8, 2, pal.base], [13, 6 + b, 5, 1, pal.highlight]]
    : [
        [11, 3 + b, 10, 2, pal.base], [10, 4 + b, 12, 3, pal.base],
        [12, 4 + b, 6, 1, pal.highlight], [10, 6 + b, 2, 3, pal.shade], [20, 6 + b, 2, 2, pal.shade],
      ];
  appendSouthStyleHair(out, pal, { style, b, hb, hooded });
  return out;
}

function northPonytailHair(pal: ToneTriad, b: number, pose: CharacterPose): PixelRect[] {
  const hb = pose.hairBobY;
  const sway = Math.sign(pose.stride);
  return [
    [11, 3 + b, 10, 2, pal.base],
    [10, 4 + b, 12, 6, pal.base],
    [11, 9 + b, 10, 2, pal.shade],
    [14, 1 + b + hb, 4, 2, pal.base],
    [13, 2 + b + hb, 6, 3, pal.highlight],
    [14, 5 + b, 4, 1, BELT_DARK],
    [12 + sway, 6 + b + hb, 8, 5, pal.shade],
    [13 + sway, 6 + b + hb, 6, 5, pal.base],
    [14 + sway, 6 + b + hb, 4, 3, pal.highlight],
    [13 + sway, 11 + b + hb, 6, 2, pal.shade],
    [14 + sway, 11 + b + hb, 4, 3, pal.base],
    [15 + sway, 14 + b + hb, 2, 2, pal.highlight],
  ];
}

function northHair(pal: ToneTriad, style: HairStyleId, input: { readonly b: number; readonly pose: CharacterPose }): PixelRect[] {
  const { b, pose } = input;
  if (style === "ponytail") return northPonytailHair(pal, b, pose);
  const sway = Math.sign(pose.stride);
  const out: PixelRect[] = [
    [11, 3 + b, 10, 2, pal.base],
    [10, 4 + b, 12, 9, pal.base],
    [12, 4 + b, 7, 2, pal.highlight],
    [11, 11 + b, 10, 3, pal.shade],
  ];
  if (style === "spiky") {
    out.push([10, 1 + b + pose.hairBobY, 3, 3, pal.base], [14, 0 + b + pose.hairBobY, 4, 4, pal.highlight], [19, 1 + b + pose.hairBobY, 3, 3, pal.base]);
  } else if (style === "long") {
    out.push([10 + sway, 12 + b, 12, 8, pal.shade], [12 + sway, 13 + b, 8, 6, pal.base]);
  }
  return out;
}

function sideHair(pal: ToneTriad, style: HairStyleId, input: { readonly b: number; readonly hb: number; readonly hooded: boolean }): PixelRect[] {
  const { b, hb, hooded } = input;
  if (hooded) return style === "long" ? [[11, 11 + b, 3, 6 + hb, pal.shade]] : [[17, 6 + b, 3, 2, pal.highlight]];
  const out: PixelRect[] = [
    [12, 3 + b, 8, 2, pal.base],
    [10, 4 + b, 10, 5, pal.base],
    [10, 8 + b, 5, 4, pal.base],
    [13, 4 + b, 5, 1, pal.highlight],
    [15, 5 + b, 3, 1, pal.highlight],
    [18, 5 + b, 3, 2, pal.base],
    [20, 6 + b, 1, 2, pal.base],
    [15, 7 + b, 2, 3, pal.base],
    [14, 9 + b, 1, 2, pal.shade],
    [10, 10 + b, 3, 2, pal.shade],
  ];
  if (style === "spiky") {
    out.push([10, 2 + b + hb, 3, 2, pal.base], [13, 0 + b + hb, 4, 3, pal.highlight], [18, 2 + b + hb, 3, 2, pal.base]);
  } else if (style === "long") {
    out.push([9, 8 + b, 4, 10 + hb, pal.shade], [10, 9 + b, 2, 9 + hb, pal.base]);
  } else if (style === "ponytail") {
    out.push(
      [9, 4 + b, 2, 2, BELT_DARK],
      [6, 2 + b + hb, 4, 3, pal.base], [6, 2 + b + hb, 3, 1, pal.highlight],
      [4, 4 + b + hb, 4, 4, pal.base], [5, 4 + b + hb, 2, 3, pal.highlight],
      [5, 7 + b + hb, 3, 2, pal.shade], [3, 7 + b + hb, 2, 3, pal.shade], [2, 9 + b + hb, 2, 2, pal.base],
    );
  }
  return out;
}

export function buildHairRects(input: {
  readonly appearance: CharacterAppearance;
  readonly dir: FacingDir;
  readonly pose: CharacterPose;
  readonly hooded: boolean;
}): PixelRect[] {
  const style = input.appearance.hairStyle;
  if (style === "bald") return [];
  const pal = HAIR_PALETTES[input.appearance.hairColor] ?? HAIR_PALETTES.brown!;
  const b = input.pose.bobY;
  const hb = input.pose.hairBobY;
  if (input.dir === "north") return input.hooded ? [] : northHair(pal, style, { b, pose: input.pose });
  if (input.dir === "side") return sideHair(pal, style, { b, hb, hooded: input.hooded });
  return southHair(pal, style, { b, hb, hooded: input.hooded });
}
