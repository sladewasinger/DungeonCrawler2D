// Deterministic pack-art selection: which of the 7 assets/packs sheets a tile
// draws from. Floors/walls pick a PATCH-coherent dominant pack (neighbors read
// as one material) while still mixing every pack across a whole floor; stairs
// and doors pick from the packs that actually carry that category. Pure data
// shaping — no Phaser here (packSprite.ts turns a pick into a sprite).
import { hash2D } from "@dc2d/engine";
import type { StairRef, TileRef } from "@dc2d/content";
import { bootTileCatalog, tilePackFrameIndex, tilePackSheetKey } from "../../boot/tilePackManifest.js";
import { stacksVertically } from "./stairTread.js";

export interface PackTileFrame {
  readonly textureKey: string;
  readonly frame: number;
}

/** Neighborhood size a "dominant pack" holds before the next patch may pick a different one —
 * small enough that a single room's walls/floor read as one coherent material, large enough
 * that a whole dungeon floor still visibly mixes all 7 packs (the user's decree). */
const PATCH_TILES = 8;

const ALL_PACK_IDS = Object.keys(bootTileCatalog.packs).sort();
const WALL_PACK_IDS = ALL_PACK_IDS.filter((id) => bootTileCatalog.packs[id]!.wallFace.length > 0);
const DOOR_PACK_IDS = ALL_PACK_IDS.filter((id) => bootTileCatalog.packs[id]!.doors.length > 0);

const FLOOR_PATCH_SALT = 0x1001;
const FLOOR_ACCENT_ROLL_SALT = 0x1002;
const FLOOR_PICK_SALT = 0x1003;
const WALL_PATCH_SALT = 0x2001;
const WALL_VARIANT_SALT = 0x2002;
const DOOR_PATCH_SALT = 0x3001;
const DOOR_VARIANT_SALT = 0x3002;
const STAIR_AXIS_SALT = 0x4001;

/** Accent (non-primary) floor variant chance out of 100 — higher right against a wall/chasm
 * rim than in an open room center, mirroring the old floorFrame.ts's edge-decor bias. */
const EDGE_ACCENT_CHANCE = 8;
const OPEN_ACCENT_CHANCE = 2;

function dominantPackId(eligible: readonly string[], salt: number, wx: number, wy: number): string {
  const patchX = Math.floor(wx / PATCH_TILES);
  const patchY = Math.floor(wy / PATCH_TILES);
  return eligible[hash2D(salt, patchX, patchY) % eligible.length] ?? eligible[0]!;
}

function frameOf(packId: string, ref: TileRef): PackTileFrame {
  const sheet = bootTileCatalog.packs[packId]!.sheets[ref.sheet]!;
  return { textureKey: tilePackSheetKey(packId, ref.sheet), frame: tilePackFrameIndex(ref, sheet.cols) };
}

/** Ground floor variant for (wx, wy): a patch-coherent dominant pack, mostly its first
 * (primary/plain) listed variant, occasionally an accent variant — biased near edges. */
export function pickFloorTile(wx: number, wy: number, nearEdge: boolean): PackTileFrame {
  const packId = dominantPackId(ALL_PACK_IDS, FLOOR_PATCH_SALT, wx, wy);
  const variants = bootTileCatalog.packs[packId]!.floorVariants;
  const accentChance = nearEdge ? EDGE_ACCENT_CHANCE : OPEN_ACCENT_CHANCE;
  const wantsAccent = hash2D(FLOOR_ACCENT_ROLL_SALT, wx, wy) % 100 < accentChance && variants.length > 1;
  const pool = wantsAccent ? variants.slice(1) : variants.slice(0, 1);
  const ref = pool[hash2D(FLOOR_PICK_SALT, wx, wy) % pool.length] ?? variants[0]!;
  return frameOf(packId, ref);
}

/** True when any orthogonal neighbor counts as an edge (wall or chasm rim) — biases floor accents. */
export function isNearEdge(isEdge: (dx: number, dy: number) => boolean): boolean {
  return isEdge(-1, 0) || isEdge(1, 0) || isEdge(0, -1) || isEdge(0, 1);
}

/**
 * Wall face texture for row `rowFromTop` (1 = the face's topmost row) of the run at (wx, wy):
 * one patch-coherent dominant pack per neighborhood, a hash-picked wallFace ref from it, and —
 * when that ref is itself a multi-row strip (h > 1) — a different row of it per face row, so a
 * tall stacked face still shows some vertical variety within one material.
 */
export function pickWallFaceTile(wx: number, wy: number, rowFromTop: number): PackTileFrame {
  const packId = dominantPackId(WALL_PACK_IDS, WALL_PATCH_SALT, wx, wy);
  const refs = bootTileCatalog.packs[packId]!.wallFace;
  const ref = refs[hash2D(WALL_VARIANT_SALT, wx, wy) % refs.length] ?? refs[0]!;
  const rowOffset = ref.h > 1 ? (rowFromTop - 1) % ref.h : 0;
  return frameOf(packId, { ...ref, row: ref.row + rowOffset });
}

/** Door leaf art for the door tile at (wx, wy): patch-coherent dominant pack, hash-picked ref. */
export function pickDoorTile(wx: number, wy: number): PackTileFrame {
  const packId = dominantPackId(DOOR_PACK_IDS, DOOR_PATCH_SALT, wx, wy);
  const refs = bootTileCatalog.packs[packId]!.doors;
  const ref = refs[hash2D(DOOR_VARIANT_SALT, wx, wy) % refs.length] ?? refs[0]!;
  return frameOf(packId, ref);
}

interface StairEntry {
  readonly packId: string;
  readonly ref: StairRef;
}

/** Every `functional: true` stair piece across every pack — decorative dais/altar-step refs
 * (functional: false) are set pieces, never picked for a paintable climb (schema doc). */
const STAIR_ENTRIES: readonly StairEntry[] = ALL_PACK_IDS.flatMap((packId) =>
  bootTileCatalog.packs[packId]!.stairs.filter((ref) => ref.functional).map((ref) => ({ packId, ref })),
);

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Stair tread art for one Stairs/RUN_PADDING tile: picks one functional stair piece per whole
 * run (keyed on whichever axis stays constant along that run's climb direction, so every tile
 * in the same physical staircase agrees), then indexes its multi-row strip by climb progress `t`.
 */
export function pickStairTile(wx: number, wy: number, direction: number, t: number): PackTileFrame {
  const axisKey = stacksVertically(direction) ? wx : wy;
  const entry = STAIR_ENTRIES[hash2D(STAIR_AXIS_SALT, axisKey, 0) % STAIR_ENTRIES.length] ?? STAIR_ENTRIES[0]!;
  const treadRow = Math.round(clamp01(t) * (entry.ref.h - 1));
  return frameOf(entry.packId, { ...entry.ref, row: entry.ref.row + treadRow });
}
