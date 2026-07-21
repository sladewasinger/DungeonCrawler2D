// The terrain draw pipeline's view-space adapter (2.5D rotation lane, step 2): wraps a
// real TerrainWorld so every (vx, vy) it's queried at is read through viewToWorld first.
// This is the ENTIRE mechanism behind "wall faces are screen-relative" (invariant 2):
// ownFace.ts/pitFace.ts/cliffMask.ts are untouched, orientation-ignorant modules that only
// ever say "my south neighbor" — feeding them this proxy instead of the raw world makes
// their hardcoded (0,+1)/(±1,0) offsets automatically mean SCREEN south/east/west at
// whatever the current orientation is, with zero changes to their own logic. At
// orientation 0, viewToWorld is the literal identity, so this proxy is a pure
// passthrough — the pixel-lock regression gate (orientation 0 must be byte-identical)
// falls out for free rather than needing separate handling.
//
// Autotile masks (wallAutotileAt) are deliberately called with THIS proxy too, not the
// real world: reading its cardinal neighbors in view-space produces the bit-remapped
// mask for whichever material now sits at each SCREEN-adjacent cell — mathematically
// the same true world-adjacency facts, just visited in screen reading order, so "the
// border sits between the same two world tiles" (invariant 1) holds without any sprite
// rotation. The only queries that must go through `.toReal`/`.real` instead are the ones
// keyed to genuinely world-space DATA that doesn't rotate with the view: baked tile
// lighting (computeLightField's BFS is a real-world light-flow simulation) and the
// engine's stair climb-direction detection (a real height-gradient fact).
import type { ViewOrientation } from "../view/viewOrientation.js";
import { viewTileToWorld, type Point } from "../view/viewTransform.js";
import type { TerrainWorld } from "./terrainWorld.js";

export interface ViewTerrainWorld extends TerrainWorld {
  /** The underlying real (world-space) TerrainWorld — use only for genuinely
   * world-space data (baked lighting, stair climb direction), never for face/edge/
   * autotile decisions (those must stay view-relative, see module doc above). */
  readonly real: TerrainWorld;
  readonly orientation: ViewOrientation;
  /** Real world tile coords for the view-space cell (vx, vy). */
  toReal(vx: number, vy: number): Point;
}

/** Wraps `world` so callers reading it at (vx, vy) see whatever world cell currently
 * displays there under `orientation` — see module doc for which callers want this vs. `.real`. */
export function viewWorld(world: TerrainWorld, orientation: ViewOrientation): ViewTerrainWorld {
  // Tile-index mapping, NOT the continuous transform: a bare index through viewToWorld
  // lands one cell off on negated axes vs the same tile's interior points (see the
  // tile-index block in viewTransform.ts) — entities visibly drifted a tile from their
  // floor at 90/180/270 until the grid and the continuous paths shared this convention.
  const toReal = (vx: number, vy: number): Point => viewTileToWorld({ x: vx, y: vy }, orientation);
  return {
    real: world,
    orientation,
    toReal,
    tileAt: (vx, vy) => world.tileAt(...toRealArgs(toReal, vx, vy)),
    heightAt: (vx, vy) => world.heightAt(...toRealArgs(toReal, vx, vy)),
    zoneAt: (vx, vy) => world.zoneAt(...toRealArgs(toReal, vx, vy)),
    isSanctuary: (vx, vy) => world.isSanctuary(...toRealArgs(toReal, vx, vy)),
    isWalkable: (vx, vy) => world.isWalkable(...toRealArgs(toReal, vx, vy)),
    groundAt: (vx, vy) => world.groundAt(...toRealArgs(toReal, vx, vy)),
  };
}

function toRealArgs(toReal: (vx: number, vy: number) => Point, vx: number, vy: number): [number, number] {
  const real = toReal(vx, vy);
  return [real.x, real.y];
}

/**
 * The real-world tile-rect origin (min corner) a VIEW-space chunk rect covers, for the
 * one thing per chunk that must be computed in real world coordinates: baked lighting's
 * BFS flood, which needs the chunk's true world footprint, not its view-space one. Chunks
 * are square (CHUNK_SIZE both axes), so a 90-degree-step rotation of the rect's 4 corners
 * always lands on another axis-aligned CHUNK_SIZE square — this just finds its min corner
 * generically rather than hardcoding a per-orientation case, so it stays correct if the
 * seam ever adds non-90-degree steps.
 */
export function viewChunkWorldOrigin(baseVX: number, baseVY: number, size: number, orientation: ViewOrientation): Point {
  // Deliberately the 4 corner TILES (inclusive far edge at size - 1), not the continuous
  // boundary at baseV + size: a 90/270 step negates one axis, so the exclusive far
  // corner of the continuous rect maps to one-past the last real tile actually visited,
  // silently off-by-one-ing the origin on that axis. Using the last tile index that's
  // actually drawn — through the tile-index mapping, same as toReal — keeps this exact
  // for every orientation.
  const far = size - 1;
  const corners: Point[] = [
    { x: baseVX, y: baseVY },
    { x: baseVX + far, y: baseVY },
    { x: baseVX, y: baseVY + far },
    { x: baseVX + far, y: baseVY + far },
  ].map((c) => viewTileToWorld(c, orientation));
  return {
    x: Math.min(...corners.map((c) => c.x)),
    y: Math.min(...corners.map((c) => c.y)),
  };
}
