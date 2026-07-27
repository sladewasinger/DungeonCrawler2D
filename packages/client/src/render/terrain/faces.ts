// The height-based face decision: a south-facing brick face exists only where a
// surface actually DROPS to walkable lower ground on its south side — never from
// tile types alone, and never at internal height steps inside a mass.
import { TERRAIN, WALL_FACE_MIN_DROP, type TileType } from "@dc2d/engine";
import { isVoidTile } from "./heightShade.js";

/** Minimum drop (in height units) before a south edge earns a face. STEP_UP-sized ramps stay faceless. */
export const FACE_MIN_DROP = WALL_FACE_MIN_DROP;

/** The read surface the face decision needs — World satisfies it structurally. */
export interface TerrainRead {
  heightAt(wx: number, wy: number): number;
  tileAt(wx: number, wy: number): TileType;
  /** Preferred authoritative terrain plane; legacy fakes may omit it. */
  terrainAt?: (wx: number, wy: number) => number;
}

function isOpenGround(world: TerrainRead, wx: number, wy: number): boolean {
  // Every non-void cell has a finite Floor surface. Raised terrain is still
  // open ground; its camera-facing wall is derived from the height drop.
  return !isVoidCellAt(world, wx, wy);
}

/** Void is an empty boundary, not a lower surface that can own or receive a
 * projected face/rim. Keep this fact shared by every height-based renderer. */
export function isVoidCellAt(world: TerrainRead, wx: number, wy: number): boolean {
  return world.terrainAt?.(wx, wy) === TERRAIN.Void ||
    isVoidTile(world.tileAt(wx, wy));
}

/** True when any cardinally adjacent cell is void. Terrain beside void does
 * not receive a projected purple wall; the void remains a flat black boundary. */
export function hasVoidNeighborAt(world: TerrainRead, wx: number, wy: number): boolean {
  return isVoidCellAt(world, wx - 1, wy) ||
    isVoidCellAt(world, wx + 1, wy) ||
    isVoidCellAt(world, wx, wy - 1) ||
    isVoidCellAt(world, wx, wy + 1);
}

/** True when the surface at (wx, wy) fronts meaningfully lower open ground to its south. */
export function hasSouthFace(world: TerrainRead, wx: number, wy: number): boolean {
  if (isVoidCellAt(world, wx, wy)) return false;
  if (!isOpenGround(world, wx, wy + 1)) return false;
  return world.heightAt(wx, wy) - world.heightAt(wx, wy + 1) >= FACE_MIN_DROP;
}

/**
 * True when a WALKABLE raised surface (dais, platform rim — not wall terrain)
 * fronts lower ground south of it: these draw a half-height cliff band so the
 * platform visibly reads as raised without stealing the lower tile's floor.
 */
export function hasPlatformSouthFace(world: TerrainRead, wx: number, wy: number): boolean {
  return isOpenGround(world, wx, wy) && hasSouthFace(world, wx, wy);
}
