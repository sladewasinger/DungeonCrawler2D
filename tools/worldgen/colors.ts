// Tile/height/zone -> pixel color, per docs/VISUAL_DIRECTION.md's palette.

import { TILE, ZONE } from "../../packages/engine/src/world/types.js";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const FLOOR_BASE: Rgb = { r: 46, g: 46, b: 58 }; // #2e2e3a
const WALL_BASE: Rgb = { r: 73, g: 73, b: 86 }; // #494956
export const STAIRS_GOLD: Rgb = { r: 255, g: 210, b: 61 }; // #ffd23d
export const SANCTUARY_TEAL: Rgb = { r: 61, g: 214, b: 195 }; // #3dd6c3
const FURNITURE_ARCANE: Rgb = { r: 138, g: 108, b: 255 }; // #8a6cff
export const GLYPH_DARK: Rgb = { r: 20, g: 20, b: 28 }; // #14141c

const DOOR_TILES: ReadonlySet<number> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);
const FURNITURE_TILES: ReadonlySet<number> = new Set([TILE.CraftingTable, TILE.Stash]);

/** Height -> brightness delta per channel. Raised ground reads brighter, pits darker. */
const HEIGHT_BRIGHTNESS_PER_UNIT = 9;
const HEIGHT_CLAMP_MIN = -4;
const HEIGHT_CLAMP_MAX = 8;

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function shadeByHeight(base: Rgb, height: number): Rgb {
  const clamped = Math.max(HEIGHT_CLAMP_MIN, Math.min(HEIGHT_CLAMP_MAX, height));
  const delta = clamped * HEIGHT_BRIGHTNESS_PER_UNIT;
  return {
    r: clamp255(base.r + delta),
    g: clamp255(base.g + delta),
    b: clamp255(base.b + delta),
  };
}

function blend(base: Rgb, tint: Rgb, amount: number): Rgb {
  return {
    r: clamp255(base.r + (tint.r - base.r) * amount),
    g: clamp255(base.g + (tint.g - base.g) * amount),
    b: clamp255(base.b + (tint.b - base.b) * amount),
  };
}

/** Pixel color for one tile, folding in height shading and sanctuary tint. */
export function tileColor(tile: number, height: number, zone: number): Rgb {
  if (tile === TILE.Stairs) return STAIRS_GOLD;
  if (DOOR_TILES.has(tile)) return SANCTUARY_TEAL;
  if (FURNITURE_TILES.has(tile)) return FURNITURE_ARCANE;

  const base = tile === TILE.Wall ? WALL_BASE : FLOOR_BASE;
  const shaded = shadeByHeight(base, height);
  return zone === ZONE.Sanctuary ? blend(shaded, SANCTUARY_TEAL, 0.35) : shaded;
}

export const LEGEND: ReadonlyArray<{ label: string; color: Rgb }> = [
  { label: "FLOOR", color: FLOOR_BASE },
  { label: "WALL", color: WALL_BASE },
  { label: "STAIRS", color: STAIRS_GOLD },
  { label: "DOOR", color: SANCTUARY_TEAL },
  { label: "SANCTUARY", color: blend(FLOOR_BASE, SANCTUARY_TEAL, 0.35) },
  { label: "FURNITURE", color: FURNITURE_ARCANE },
];
