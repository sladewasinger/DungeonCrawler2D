import { fbm2D } from "../core/noise";
import { hash2D, mixSeeds } from "../core/rng";
import { CHUNK_SIZE, TILE, ZONE, type Chunk, type TileType } from "./types";

/**
 * Chunked, deterministic world generation.
 *
 * Layers (all pure functions of world coordinates, so chunk borders
 * always agree):
 *  1. Cave noise decides walls vs floor.
 *  2. A corridor network — L-shaped paths between jittered chunk
 *     centers — is carved through everything. It is the global
 *     connectivity guarantee AND the ramp system: terrain cliffs
 *     flatten into walkable slopes near corridors.
 *  3. Height = plateau field (sharp cliffs off-corridor, ramps on) +
 *     gentle rolling noise. Cliffs taller than STEP_UP are real
 *     obstacles: droppable from above, blocked from below.
 *  4. Safe rooms (sanctuary zone, flattened) on a sparse chunk grid;
 *     stairway markers on a sparser hash.
 *  5. Interior wall-enclosed pockets that touch neither a corridor nor
 *     the chunk border are sealed, so almost every open tile is
 *     reachable from the corridor network.
 */

const CAVE_FREQ = 0.055;
const CAVE_WALL_THRESHOLD = 0.585;

const CORRIDOR_HALF_WIDTH = 1.6; // carve radius (tiles)
const CORRIDOR_EASE = 6; // cliff→ramp blend radius around corridors

const PLATEAU_FREQ = 0.018;
const PLATEAU_LEVELS = 3;
const CLIFF_STEP = 3; // height difference between plateau levels
const CLIFF_RAMP_MIN = 0.12; // fraction of a level used by the cliff face

const ROLLING_FREQ = 0.09;
const ROLLING_AMP = 1.0;

const SAFE_ROOM_SPACING = 3; // one safe room per 3×3 chunk cell
const SAFE_ROOM_HALF = 5; // room is (2*half+1)² tiles
const SAFE_ROOM_MARGIN = 3; // height-blend apron around the room

const STAIRS_MODULUS = 23; // ~1 in 23 chunks hosts a stairway

interface Seeds {
  cave: number;
  plateau: number;
  rolling: number;
  layout: number;
}

function seedsFor(worldSeed: number, floor: number): Seeds {
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

function posMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function isSafeRoomChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  const layout = seedsFor(worldSeed, floor).layout;
  const offX = hash2D(mixSeeds(layout, 0x5afe), 1, 0) % SAFE_ROOM_SPACING;
  const offY = hash2D(mixSeeds(layout, 0x5afe), 0, 1) % SAFE_ROOM_SPACING;
  return posMod(cx, SAFE_ROOM_SPACING) === offX && posMod(cy, SAFE_ROOM_SPACING) === offY;
}

export function isStairsChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  const layout = seedsFor(worldSeed, floor).layout;
  return hash2D(mixSeeds(layout, 0x57a1), cx, cy) % STAIRS_MODULUS === 0;
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

/**
 * Corridor sub-segments that can touch chunk (cx, cy): the L-paths
 * from this chunk's center to its east and south neighbors, plus the
 * ones arriving from the west and north neighbors.
 */
function corridorSegments(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): Array<[number, number, number, number]> {
  const pairs: Array<[[number, number], [number, number]]> = [
    [[cx - 1, cy], [cx, cy]],
    [[cx, cy], [cx + 1, cy]],
    [[cx, cy - 1], [cx, cy]],
    [[cx, cy], [cx, cy + 1]],
  ];
  const segs: Array<[number, number, number, number]> = [];
  for (const [a, b] of pairs) {
    const A = chunkCenter(worldSeed, floor, a[0], a[1]);
    const B = chunkCenter(worldSeed, floor, b[0], b[1]);
    // L-path: horizontal from A, then vertical up/down into B.
    segs.push([A.x, A.y, B.x, A.y]);
    segs.push([B.x, A.y, B.x, B.y]);
  }
  return segs;
}

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Terrain sample at a world tile, before room/stairs overlays. */
function baseSample(
  seeds: Seeds,
  segs: Array<[number, number, number, number]>,
  wx: number,
  wy: number,
): { wall: boolean; height: number } {
  let dCorr = Infinity;
  for (const [ax, ay, bx, by] of segs) {
    const d = distToSegment(wx, wy, ax, ay, bx, by);
    if (d < dCorr) dCorr = d;
  }
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

export function generateChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): Chunk {
  const seeds = seedsFor(worldSeed, floor);
  const segs = corridorSegments(worldSeed, floor, cx, cy);

  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const corridorCarved = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const i = ly * CHUNK_SIZE + lx;
      let dCorr = Infinity;
      for (const [ax, ay, bx, by] of segs) {
        const d = distToSegment(wx, wy, ax, ay, bx, by);
        if (d < dCorr) dCorr = d;
      }
      const { wall, height: h } = baseSample(seeds, segs, wx, wy);
      tiles[i] = wall ? TILE.Wall : TILE.Floor;
      height[i] = h;
      if (dCorr <= CORRIDOR_HALF_WIDTH) corridorCarved[i] = 1;
    }
  }

  applyFlattenedFeature(worldSeed, floor, cx, cy, seeds, segs, tiles, height, zones);
  sealInteriorPockets(tiles, corridorCarved, zones);

  return { cx, cy, tiles, height, zones };
}

/** Safe rooms and stairways: cleared, flattened, height-blended into terrain. */
function applyFlattenedFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  seeds: Seeds,
  segs: Array<[number, number, number, number]>,
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
): void {
  const safeRoom = isSafeRoomChunk(worldSeed, floor, cx, cy);
  const stairs = isStairsChunk(worldSeed, floor, cx, cy);
  if (!safeRoom && !stairs) return;

  const half = safeRoom ? SAFE_ROOM_HALF : 1;
  const margin = SAFE_ROOM_MARGIN;
  const jitterRange = safeRoom ? 3 : 6;
  const jx = (hash2D(mixSeeds(seeds.layout, 0xf1a7), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const jy = (hash2D(mixSeeds(seeds.layout, 0xf1a8), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const centerLx = CHUNK_SIZE / 2 + jx;
  const centerLy = CHUNK_SIZE / 2 + jy;

  const centerSample = baseSample(
    seeds,
    segs,
    cx * CHUNK_SIZE + centerLx,
    cy * CHUNK_SIZE + centerLy,
  );
  const featureH = centerSample.height;

  const reach = half + margin;
  for (let ly = centerLy - reach; ly <= centerLy + reach; ly++) {
    for (let lx = centerLx - reach; lx <= centerLx + reach; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const d = Math.max(Math.abs(lx - centerLx), Math.abs(ly - centerLy));
      tiles[i] = TILE.Floor;
      if (d <= half) {
        height[i] = featureH;
        if (safeRoom) zones[i] = ZONE.Sanctuary;
        else tiles[i] = TILE.Stairs;
      } else {
        const t = smoothstep01((d - half) / margin);
        height[i] = featureH + (height[i]! - featureH) * t;
      }
    }
  }
}

/**
 * Seal wall-enclosed floor pockets that touch neither a corridor, a
 * feature tile, nor the chunk border (border pockets may continue into
 * the neighbor chunk, so they survive).
 */
function sealInteriorPockets(
  tiles: Uint8Array,
  corridorCarved: Uint8Array,
  zones: Uint8Array,
): void {
  const size = CHUNK_SIZE;
  const reached = new Uint8Array(size * size);
  const queue: number[] = [];

  for (let i = 0; i < size * size; i++) {
    if (tiles[i] === TILE.Wall) continue;
    const lx = i % size;
    const ly = (i - lx) / size;
    const onBorder = lx === 0 || ly === 0 || lx === size - 1 || ly === size - 1;
    if (corridorCarved[i] === 1 || zones[i] !== ZONE.None || tiles[i] === TILE.Stairs || onBorder) {
      reached[i] = 1;
      queue.push(i);
    }
  }

  while (queue.length > 0) {
    const i = queue.pop()!;
    const lx = i % size;
    const ly = (i - lx) / size;
    const neighbors = [
      lx > 0 ? i - 1 : -1,
      lx < size - 1 ? i + 1 : -1,
      ly > 0 ? i - size : -1,
      ly < size - 1 ? i + size : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || reached[n] === 1 || tiles[n] === TILE.Wall) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }

  for (let i = 0; i < size * size; i++) {
    if (tiles[i] !== TILE.Wall && reached[i] === 0) tiles[i] = TILE.Wall;
  }
}

export type { TileType };
