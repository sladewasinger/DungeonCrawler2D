// Cliff-face groundwork for non-wall height rises (pit/dais/chasm-bridge rims that
// never became a wall tile): a shadowed lip on the lower tile's edge so the drop
// reads at a glance instead of the terrain silently teleporting height.
import { TILE, type TileType } from "@dc2d/engine";

const EPSILON = 0.35; // ignores float noise from ramp blending; a real step is >> this

/** The minimal tile/height read this needs — satisfied by World, easy to fake in tests. */
export interface TerrainSource {
  heightAt(wx: number, wy: number): number;
  tileAt(wx: number, wy: number): TileType;
}

interface LipNeighbor {
  readonly dx: number;
  readonly dy: number;
  readonly angle: number;
}

const NEIGHBORS: readonly LipNeighbor[] = [
  { dx: 0, dy: -1, angle: 180 },
  { dx: 1, dy: 0, angle: 270 },
  { dx: 0, dy: 1, angle: 0 },
  { dx: -1, dy: 0, angle: 90 },
];

/** Rotation for a shadow lip on this (lower) tile, or null if every neighbor is flat/a wall. */
export function edgeLipAngle(world: TerrainSource, wx: number, wy: number): number | null {
  const here = world.heightAt(wx, wy);
  for (const n of NEIGHBORS) {
    if (world.tileAt(wx + n.dx, wy + n.dy) === TILE.Wall) continue;
    if (world.heightAt(wx + n.dx, wy + n.dy) - here > EPSILON) return n.angle;
  }
  return null;
}
