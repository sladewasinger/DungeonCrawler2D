// Stair tread orientation: rotates the pack's single floor_stairs tile to face
// whichever neighbor this tile actually climbs toward, per the generator's ramp.

/** The minimal height read this needs — satisfied by World, easy to fake in tests. */
export interface HeightSource {
  heightAt(wx: number, wy: number): number;
}

interface StairNeighbor {
  readonly dx: number;
  readonly dy: number;
  readonly angle: number;
}

/** The pack's tread art faces "up" toward the top of its own frame — 0deg climbs north. */
const NEIGHBORS: readonly StairNeighbor[] = [
  { dx: 0, dy: -1, angle: 0 },
  { dx: 1, dy: 0, angle: 90 },
  { dx: 0, dy: 1, angle: 180 },
  { dx: -1, dy: 0, angle: 270 },
];

/** Rotation (degrees) for the stair tread at (wx, wy): points toward its highest neighbor. */
export function stairAngle(world: HeightSource, wx: number, wy: number): number {
  const here = world.heightAt(wx, wy);
  let bestAngle = 0; // default: north, matches NEIGHBORS[0]
  let bestRise = -Infinity;
  for (const n of NEIGHBORS) {
    const rise = world.heightAt(wx + n.dx, wy + n.dy) - here;
    if (rise > bestRise) {
      bestRise = rise;
      bestAngle = n.angle;
    }
  }
  return bestAngle;
}
