import { fbm2D } from "../core/noise";
import { hash2D, mixSeeds } from "../core/rng";
import { CHUNK_SIZE } from "./types";

/**
 * Base terrain sampling — pure functions of world coordinates, so
 * chunk borders always agree:
 *  - Cave noise decides walls vs floor.
 *  - A corridor network — L-shaped paths between jittered chunk
 *    centers — is carved through everything. It is the global
 *    connectivity guarantee AND the ramp system: terrain cliffs
 *    flatten into walkable slopes near corridors.
 *  - Height = plateau field (sharp cliffs off-corridor, ramps on) +
 *    gentle rolling noise. Cliffs taller than STEP_UP are real
 *    obstacles: droppable from above, blocked from below.
 */

const CAVE_FREQ = 0.055;
const CAVE_WALL_THRESHOLD = 0.585;

export const CORRIDOR_HALF_WIDTH = 1.6; // carve radius (tiles)
const CORRIDOR_EASE = 6; // cliff→ramp blend radius around corridors

const PLATEAU_FREQ = 0.018;
const PLATEAU_LEVELS = 3;
const CLIFF_STEP = 3; // height difference between plateau levels
const CLIFF_RAMP_MIN = 0.12; // fraction of a level used by the cliff face

const ROLLING_FREQ = 0.09;
const ROLLING_AMP = 1.0;

export interface Seeds {
  cave: number;
  plateau: number;
  rolling: number;
  layout: number;
}

export function seedsFor(worldSeed: number, floor: number): Seeds {
  return {
    cave: mixSeeds(worldSeed, floor, 0xca7e),
    plateau: mixSeeds(worldSeed, floor, 0x9127),
    rolling: mixSeeds(worldSeed, floor, 0x2011),
    layout: mixSeeds(worldSeed, floor, 0x1a10),
  };
}

/** Jittered chunk center in world tile coords — corridor endpoints and spawn anchors. */
export function chunkCenter(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const layout = seedsFor(worldSeed, floor).layout;
  const jx = (hash2D(layout, cx, cy) % 13) - 6;
  const jy = (hash2D(mixSeeds(layout, 0x0aa1), cx, cy) % 13) - 6;
  return {
    x: cx * CHUNK_SIZE + CHUNK_SIZE / 2 + jx,
    y: cy * CHUNK_SIZE + CHUNK_SIZE / 2 + jy,
  };
}

/** Distance from point to an axis-aligned segment. */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export type CorridorSegment = [number, number, number, number];

/**
 * Corridor sub-segments that can touch chunk (cx, cy): the L-paths
 * from this chunk's center to its east and south neighbors, plus the
 * ones arriving from the west and north neighbors.
 */
export function corridorSegments(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): CorridorSegment[] {
  const pairs: Array<[[number, number], [number, number]]> = [
    [[cx - 1, cy], [cx, cy]],
    [[cx, cy], [cx + 1, cy]],
    [[cx, cy - 1], [cx, cy]],
    [[cx, cy], [cx, cy + 1]],
  ];
  const segs: CorridorSegment[] = [];
  for (const [a, b] of pairs) {
    const A = chunkCenter(worldSeed, floor, a[0], a[1]);
    const B = chunkCenter(worldSeed, floor, b[0], b[1]);
    // L-path: horizontal from A, then vertical up/down into B.
    segs.push([A.x, A.y, B.x, A.y]);
    segs.push([B.x, A.y, B.x, B.y]);
  }
  return segs;
}

export function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function distToCorridor(segs: CorridorSegment[], wx: number, wy: number): number {
  let dCorr = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    const d = distToSegment(wx, wy, ax, ay, bx, by);
    if (d < dCorr) dCorr = d;
  }
  return dCorr;
}

/** Terrain sample at a world tile, before room/stairs overlays. */
export function baseSample(
  seeds: Seeds,
  segs: CorridorSegment[],
  wx: number,
  wy: number,
): { wall: boolean; height: number } {
  const dCorr = distToCorridor(segs, wx, wy);
  const carved = dCorr <= CORRIDOR_HALF_WIDTH;
  const corridorness = smoothstep01(1 - dCorr / CORRIDOR_EASE);

  const cave = fbm2D(seeds.cave, wx * CAVE_FREQ, wy * CAVE_FREQ, 3);
  const wall = !carved && cave > CAVE_WALL_THRESHOLD;

  // Plateaus: quantized levels with a controllable ramp width. Off
  // corridors the ramp is a near-vertical cliff face; on corridors it
  // widens into a fully walkable slope.
  const p = fbm2D(seeds.plateau, wx * PLATEAU_FREQ, wy * PLATEAU_FREQ, 2);
  const t = Math.min(PLATEAU_LEVELS - 1e-6, p * PLATEAU_LEVELS);
  const level = Math.floor(t);
  const frac = t - level;
  const rampWidth = CLIFF_RAMP_MIN + (1 - CLIFF_RAMP_MIN) * corridorness;
  const ramp = smoothstep01((frac - (0.5 - rampWidth / 2)) / rampWidth);
  const plateauHeight = (level + ramp) * CLIFF_STEP;

  const rolling =
    (fbm2D(seeds.rolling, wx * ROLLING_FREQ, wy * ROLLING_FREQ, 2) - 0.5) *
    2 *
    ROLLING_AMP;

  return { wall, height: plateauHeight + rolling };
}
