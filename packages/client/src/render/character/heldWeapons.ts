/** Dedicated 1px-outlined grip-anchored in-hand weapon, torch, lantern, and hand sprites. */
import type { Texture } from "pixi.js";
import { getItemHeldTexture } from "../../ui/icons/itemIcons.js";
import { canvasToNearestTexture, createPixelCanvas, drawRects, stampDarkOutline, type PixelRect } from "../textures/pixelCanvas.js";
import { OUTLINE_RGB } from "./characterTypes.js";

export type HeldAimMode = "aim360" | "meleeCarry" | "upright";

export interface GripSocket {
  readonly x: number;
  readonly y: number;
  readonly showHand: boolean;
  readonly overWeapon?: boolean | undefined;
}

export interface WeaponGripSockets {
  readonly primary: GripSocket;
  readonly secondary?: GripSocket | undefined;
  readonly twoHandStyle?: "bowDraw" | "shaftTwoHand" | undefined;
}

export interface HeldWeaponVisual {
  readonly texture: Texture;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly aimMode: HeldAimMode;
  readonly twoHanded: boolean;
  readonly grips: WeaponGripSockets;
  readonly spriteScale: number;
}

const WOOD_DARK = "#6b3f1d";
const WOOD_LIGHT = "#9c6234";
const STEEL_DARK = "#64748b";
const STEEL_MID = "#94a3b8";
const STEEL_EDGE = "#e2e8f0";
const GOLD = "#f59e0b";
const TORCH_ORANGE = "#f97316";
const TORCH_GOLD = "#fde047";

const cache = new Map<string, Texture>();
const torchAnim: Texture[] = [];
const lanternAnim: Texture[] = [];

function bake(key: string, size: { readonly w: number; readonly h: number }, rects: readonly PixelRect[]): Texture {
  const existing = cache.get(key);
  if (existing) return existing;
  const { canvas, ctx } = createPixelCanvas(size.w, size.h);
  drawRects(ctx, rects);
  stampDarkOutline(ctx, size, OUTLINE_RGB);
  const tex = canvasToNearestTexture(canvas);
  cache.set(key, tex);
  return tex;
}

function makeSwordTex(): Texture {
  return bake("sword", { w: 26, h: 12 }, [
    [2, 5, 2, 2, GOLD], [4, 5, 4, 2, WOOD_DARK], [8, 2, 2, 8, STEEL_DARK], [8, 3, 2, 6, GOLD],
    [10, 4, 13, 4, STEEL_MID], [10, 4, 14, 2, STEEL_EDGE], [10, 7, 11, 1, STEEL_DARK], [23, 5, 2, 2, STEEL_EDGE],
  ]);
}

function makeBowTex(): Texture {
  return bake("bow", { w: 16, h: 26 }, [
    [3, 4, 1, 18, "#e2e8f0"], [3, 2, 3, 3, WOOD_DARK], [5, 4, 3, 4, WOOD_LIGHT], [7, 8, 2, 3, WOOD_LIGHT],
    [7, 11, 2, 4, GOLD], [7, 15, 2, 3, WOOD_LIGHT], [5, 18, 3, 4, WOOD_LIGHT], [3, 21, 3, 3, WOOD_DARK],
    [3, 12, 9, 2, "#b47b48"], [2, 11, 2, 4, "#f1f5f9"], [12, 11, 2, 4, STEEL_EDGE], [14, 12, 2, 2, STEEL_EDGE],
  ]);
}

function makeAxeTex(): Texture {
  return bake("axe", { w: 24, h: 14 }, [
    [2, 5, 17, 2, WOOD_DARK], [4, 5, 12, 1, WOOD_LIGHT], [16, 4, 3, 4, STEEL_DARK],
    [14, 7, 7, 4, STEEL_MID], [18, 6, 4, 6, STEEL_EDGE], [15, 6, 5, 2, STEEL_DARK],
  ]);
}

function makePickaxeTex(): Texture {
  return bake("pickaxe", { w: 24, h: 16 }, [
    [2, 7, 16, 2, WOOD_DARK], [4, 7, 12, 1, WOOD_LIGHT], [16, 6, 3, 4, STEEL_MID],
    [15, 2, 4, 12, STEEL_DARK], [17, 2, 4, 4, STEEL_MID], [17, 10, 4, 4, STEEL_MID],
    [20, 2, 2, 2, STEEL_EDGE], [20, 12, 2, 2, STEEL_EDGE],
  ]);
}

export function getGrippingHandTexture(female = false): Texture {
  if (female) {
    return bake("hand:female", { w: 4, h: 4 }, [[1, 1, 2, 2, "#ffffff"], [1, 2, 2, 1, "#d4d4d8"]]);
  }
  return bake("hand:male", { w: 5, h: 5 }, [[1, 1, 3, 3, "#ffffff"], [1, 3, 3, 1, "#d4d4d8"]]);
}

export function getInHandTorchFrames(): readonly Texture[] {
  if (torchAnim.length > 0) return torchAnim;
  for (let f = 0; f < 4; f++) {
    const sway = f % 2;
    torchAnim.push(bake(`torch:${f}`, { w: 12, h: 22 }, [
      [5, 10, 2, 10, WOOD_DARK], [4, 9, 4, 2, STEEL_DARK],
      [4 + sway, 4, 4, 5, TORCH_ORANGE], [5, 3 + sway, 2, 5, TORCH_GOLD], [5 + sway, 5, 1, 2, "#fef9c3"],
    ]));
  }
  return torchAnim;
}

export function getWaistLanternFrames(): readonly Texture[] {
  if (lanternAnim.length > 0) return lanternAnim;
  for (let f = 0; f < 2; f++) {
    lanternAnim.push(bake(`lantern:${f}`, { w: 10, h: 13 }, [
      [3, 1, 4, 1, STEEL_MID], [3, 2, 1, 2, STEEL_DARK], [6, 2, 1, 2, STEEL_DARK],
      [3, 3, 4, 2, STEEL_DARK], [2, 5, 6, 6, GOLD],
      [3, 6, 4, 4, f === 0 ? TORCH_GOLD : TORCH_ORANGE], [4, 7, 2, 2, "#fef9c3"], [3, 11, 4, 1, STEEL_DARK],
    ]));
  }
  return lanternAnim;
}

interface WeaponSpec {
  readonly buildTex: () => Texture;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly aimMode: HeldAimMode;
  readonly twoHanded: boolean;
  readonly grips: WeaponGripSockets;
}

const SINGLE_HAND_GRIP: WeaponGripSockets = { primary: { x: 0, y: 0, showHand: true } };
const NO_HAND_GRIP: WeaponGripSockets = { primary: { x: 0, y: 0, showHand: false } };
const BOW_GRIPS: WeaponGripSockets = {
  primary: { x: 0, y: 0, showHand: true },
  secondary: { x: -4, y: 0, showHand: true, overWeapon: true },
  twoHandStyle: "bowDraw",
};

const WEAPON_SPECS: Readonly<Record<string, WeaponSpec>> = {
  sword: { buildTex: makeSwordTex, anchorX: 0.22, anchorY: 0.5, aimMode: "meleeCarry", twoHanded: false, grips: SINGLE_HAND_GRIP },
  bow: { buildTex: makeBowTex, anchorX: 0.44, anchorY: 0.5, aimMode: "aim360", twoHanded: true, grips: BOW_GRIPS },
  axe: { buildTex: makeAxeTex, anchorX: 0.22, anchorY: 0.42, aimMode: "meleeCarry", twoHanded: false, grips: SINGLE_HAND_GRIP },
  pickaxe: { buildTex: makePickaxeTex, anchorX: 0.22, anchorY: 0.5, aimMode: "meleeCarry", twoHanded: false, grips: SINGLE_HAND_GRIP },
};

export function getHeldWeaponVisual(itemId: string | null | undefined, timeSec: number): HeldWeaponVisual | null {
  if (!itemId) return null;
  const spec = WEAPON_SPECS[itemId];
  if (spec) {
    return {
      texture: spec.buildTex(), anchorX: spec.anchorX, anchorY: spec.anchorY,
      aimMode: spec.aimMode, twoHanded: spec.twoHanded, grips: spec.grips, spriteScale: 0.75,
    };
  }
  if (itemId === "torch") {
    const frames = getInHandTorchFrames();
    const tex = frames[Math.floor(timeSec * 10) % frames.length] ?? frames[0]!;
    return { texture: tex, anchorX: 0.5, anchorY: 0.72, aimMode: "upright", twoHanded: false, grips: SINGLE_HAND_GRIP, spriteScale: 0.75 };
  }
  const fallback = getItemHeldTexture(itemId);
  if (!fallback) return null;
  return { texture: fallback, anchorX: 0.5, anchorY: 0.65, aimMode: "upright", twoHanded: false, grips: NO_HAND_GRIP, spriteScale: 0.58 };
}
