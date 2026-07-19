// The height-based face decision: a south-facing brick face exists only where a
// surface actually DROPS to walkable lower ground on its south side — never from
// tile types alone, and never at internal height steps inside a mass.
import { TILE, type TileType } from "@dc2d/engine";

/** Minimum drop (in height units) before a south edge earns a face. STEP_UP-sized ramps stay faceless. */
export const FACE_MIN_DROP = 1.5;

/** The read surface the face decision needs — World satisfies it structurally. */
export interface TerrainRead {
  heightAt(wx: number, wy: number): number;
  tileAt(wx: number, wy: number): TileType;
}

function isOpenGround(world: TerrainRead, wx: number, wy: number): boolean {
  return world.tileAt(wx, wy) !== TILE.Wall;
}

/** True when the surface at (wx, wy) fronts meaningfully lower open ground to its south. */
export function hasSouthFace(world: TerrainRead, wx: number, wy: number): boolean {
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
