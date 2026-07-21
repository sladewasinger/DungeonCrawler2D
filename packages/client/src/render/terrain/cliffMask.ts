// Shared world-space cliff mask (WAVE R2, docs/ROADMAP.md "full-perimeter white
// cliff-edge outlines" + "floor-rim occlusion"): for a tile, which of its 4 world
// neighbors sit low enough over OPEN ground to read as an exposed cliff edge —
// the single fact both consumers below share instead of each re-deriving it:
//   1. drawGroundTile.ts's drawTopEdges: outline every exposed side of a WALKABLE
//      cap white, on its shifted surface (docs/ROADMAP.md "OUTLINE SCOPE
//      CORRECTION" — wall bodies never get white edges, so no wall draw path
//      consumes this).
//   2. entities/occlusion.ts: any terrain higher than an entity, screen-south of
//      it, occludes — floor rims exactly like walls.
// Pure height/tile facts (TerrainRead), independent of which draw path (walkable
// top, raised face row, pit face row) the tile itself renders through — exactly
// like autotile.ts's masks. World-space and orientation-ignorant: a caller that
// wants the SCREEN-relative sides feeds this the view-space proxy (viewWorld.ts)
// instead of rotating anything here (viewWorld.ts's module doc, invariant 1).
import { TILE } from "@dc2d/engine";
import { FACE_MIN_DROP, type TerrainRead } from "./faces.js";

export interface CliffSides {
  readonly north: boolean;
  readonly south: boolean;
  readonly east: boolean;
  readonly west: boolean;
}

/** True once `neighbor` sits far enough below `height` to read as an exposed
 * drop — the one threshold every cliff consumer shares (ownFace.ts's own
 * south-face rule, generalized to every direction). */
export function isCliffDrop(height: number, neighbor: number): boolean {
  return height - neighbor >= FACE_MIN_DROP;
}

function isOpenGround(world: TerrainRead, wx: number, wy: number): boolean {
  return world.tileAt(wx, wy) !== TILE.Wall;
}

/**
 * Which of (wx, wy)'s 4 world neighbors sit low enough, over open ground, to
 * count as an exposed cliff edge. A WALL neighbor never counts, even if it
 * happens to sit lower — that side already carries its own black bitmask
 * border from autotile.ts, and a white line on top of it would just look
 * muddy, not add information.
 */
export function cliffSidesAt(world: TerrainRead, wx: number, wy: number): CliffSides {
  const height = world.heightAt(wx, wy);
  const drop = (nx: number, ny: number): boolean =>
    isOpenGround(world, nx, ny) && isCliffDrop(height, world.heightAt(nx, ny));
  return {
    north: drop(wx, wy - 1),
    south: drop(wx, wy + 1),
    east: drop(wx + 1, wy),
    west: drop(wx - 1, wy),
  };
}
