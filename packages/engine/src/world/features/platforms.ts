import { hash2D, mixSeeds } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "./fixed.js";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  chunkCenter,
  corridorSegments,
  distToCorridor,
  seedsFor,
  type CorridorSegment,
  type Seeds,
} from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";

/**
 * Ruin platform clusters — the jump playground of the overworld.
 * Roughly one chunk in four grows a flattened pad holding a handful of
 * mesas raised in +2 steps: +2 is exactly jumpable (jump apex ≈ 2.2),
 * so you hop pad → mesa → across 1–3 tile gaps — and the tall central
 * mesa adds a second +2 step to +4. The server drops loot on the tops;
 * knockback near an edge is exactly as dangerous as it sounds.
 *
 * Everything derives from (worldSeed, floor, chunk) hashes and stays
 * inside the chunk interior, so seams and determinism are untouched.
 * The cluster anchors diagonally OFF the chunk's corridor junction and
 * mesas never rise onto the corridor itself, so the corridor network
 * (and the connectivity guarantee it carries) walks straight through.
 */

const PLATFORM_MODULUS = 4; // ~1 in 4 eligible chunks
export const PLATFORM_TIER_STEP = 2; // jumpable rise per tier
const PAD = 8; // flattened pad half-size (chebyshev)
const PAD_MARGIN = 2; // height-blend apron around the pad
const REACH = PAD + PAD_MARGIN;
/** Mesas keep this far from corridor centerlines (walk-through stays). */
const CORRIDOR_CLEAR = CORRIDOR_HALF_WIDTH + 1;

interface Mesa {
  dx: number;
  dy: number;
  /** Half-sizes: mesa spans (dx±hx, dy±hy) around the cluster center. */
  hx: number;
  hy: number;
  /** 1 → +2, 2 → +4 (as a second step on top of a tier-1 skirt). */
  tier: 1 | 2;
}

export function hasPlatformCluster(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  // The proving ground (chunks 0..1) is authored; feature chunks keep
  // their clearings for the safe-room kiosk / stairway pad.
  if (cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1) return false;
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  if (isStairsChunk(worldSeed, floor, cx, cy)) return false;
  const layout = seedsFor(worldSeed, floor).layout;
  return hash2D(mixSeeds(layout, 0x9e5a), cx, cy) % PLATFORM_MODULUS === 0;
}

const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Cluster center in chunk-local coords — diagonally off the corridor junction (pure). */
function clusterCenter(
  worldSeed: number,
  floor: number,
  seeds: Seeds,
  cx: number,
  cy: number,
): { lx: number; ly: number } {
  const junction = chunkCenter(worldSeed, floor, cx, cy);
  const jlx = junction.x - cx * CHUNK_SIZE;
  const jly = junction.y - cy * CHUNK_SIZE;
  const [ddx, ddy] = DIAG[hash2D(mixSeeds(seeds.layout, 0x9e5b), cx, cy) % 4] ?? [1, 1];
  const clamp = (v: number) => Math.max(REACH, Math.min(CHUNK_SIZE - 1 - REACH, Math.round(v)));
  return { lx: clamp(jlx + ddx * 8), ly: clamp(jly + ddy * 8) };
}

/** Deterministic mesa layout for a cluster (pure). */
function mesasFor(seeds: Seeds, cx: number, cy: number): Mesa[] {
  // salt as its own mix part: additive salts correlate hash2D outputs
  // across salts, which stacked every mesa on the same offset.
  const h = (salt: number) => hash2D(mixSeeds(seeds.layout, 0x9e60, salt), cx, cy);
  const count = 3 + (h(0) % 3); // 3..5 mesas
  const mesas: Mesa[] = [];
  // The first mesa is the tall centerpiece: a tier-1 skirt with a
  // tier-2 core (handled in mesaRiseAt); the rest ring it at hop-able
  // offsets.
  mesas.push({ dx: 0, dy: 0, hx: 2, hy: 2, tier: 2 });
  for (let k = 1; k < count; k++) {
    const angle = ((h(k * 3 + 1) % 8) / 8) * Math.PI * 2;
    const dist = 5 + (h(k * 3 + 2) % 2); // 5..6 tiles out — gaps of 1..3
    mesas.push({
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      hx: 1 + (h(k * 3 + 3) % 2), // half-sizes 1..2 → mesas 3..5 wide
      hy: 1 + (h(k * 3 + 4) % 2),
      tier: 1,
    });
  }
  return mesas;
}

/** Raised height (0, +2, or +4) this cluster adds at a local offset. */
function mesaRiseAt(mesas: Mesa[], ox: number, oy: number): number {
  let rise = 0;
  for (const m of mesas) {
    const inX = Math.abs(ox - m.dx) <= m.hx;
    const inY = Math.abs(oy - m.dy) <= m.hy;
    if (!inX || !inY) continue;
    let tier = 1;
    if (m.tier === 2 && Math.abs(ox - m.dx) <= m.hx - 1 && Math.abs(oy - m.dy) <= m.hy - 1) {
      tier = 2; // inner core one more jump up
    }
    rise = Math.max(rise, tier * PLATFORM_TIER_STEP);
  }
  return rise;
}

/**
 * Stamp a platform cluster over a chunk's generated data (runs after
 * the flattened features, before pocket sealing).
 */
/** Cluster height at one chunk-local tile: pad-level inside the corridor guard, mesa rise elsewhere. */
function padTileHeight(
  mesas: Mesa[],
  segs: CorridorSegment[],
  cx: number,
  cy: number,
  centerLx: number,
  centerLy: number,
  padH: number,
  lx: number,
  ly: number,
): number {
  const wx = cx * CHUNK_SIZE + lx;
  const wy = cy * CHUNK_SIZE + ly;
  // Corridors stay at pad level — the walk-through guarantee.
  const nearCorridor = distToCorridor(segs, wx, wy) <= CORRIDOR_CLEAR;
  const rise = nearCorridor ? 0 : mesaRiseAt(mesas, lx - centerLx, ly - centerLy);
  return padH + rise;
}

export function applyPlatformCluster(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  seeds: Seeds,
  segs: CorridorSegment[],
  tiles: Uint8Array,
  height: Float32Array,
): void {
  if (!hasPlatformCluster(worldSeed, floor, cx, cy)) return;
  const { lx: centerLx, ly: centerLy } = clusterCenter(worldSeed, floor, seeds, cx, cy);
  const mesas = mesasFor(seeds, cx, cy);
  const padH = baseSample(
    seeds,
    segs,
    cx * CHUNK_SIZE + centerLx,
    cy * CHUNK_SIZE + centerLy,
  ).height;

  for (let ly = centerLy - REACH; ly <= centerLy + REACH; ly++) {
    for (let lx = centerLx - REACH; lx <= centerLx + REACH; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const d = Math.max(Math.abs(lx - centerLx), Math.abs(ly - centerLy));
      if (d <= PAD) {
        // The pad clears cave walls so the ruins stand in the open.
        tiles[i] = TILE.Floor;
        height[i] = padTileHeight(mesas, segs, cx, cy, centerLx, centerLy, padH, lx, ly);
      } else {
        const t = (d - PAD) / PAD_MARGIN;
        const smooth = t * t * (3 - 2 * t);
        height[i] = padH + ((height[i] ?? 0) - padH) * smooth;
      }
    }
  }
}

/**
 * World-coordinate tops of this chunk's mesas — loot spots for the
 * server. Only mesas whose top actually rose count (a mesa the
 * corridor guard flattened isn't a platform). Empty when the chunk has
 * no cluster.
 */
export function platformLootSpots(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): Array<{ x: number; y: number }> {
  if (!hasPlatformCluster(worldSeed, floor, cx, cy)) return [];
  const seeds = seedsFor(worldSeed, floor);
  const { lx, ly } = clusterCenter(worldSeed, floor, seeds, cx, cy);
  const spots: Array<{ x: number; y: number }> = [];
  for (const m of mesasFor(seeds, cx, cy)) {
    const tlx = lx + m.dx;
    const tly = ly + m.dy;
    if (tlx < 0 || tly < 0 || tlx >= CHUNK_SIZE || tly >= CHUNK_SIZE) continue;
    const wx = cx * CHUNK_SIZE + tlx;
    const wy = cy * CHUNK_SIZE + tly;
    // Recompute the guard the stamp applied — pure, so it agrees.
    const segs = corridorSegments(worldSeed, floor, cx, cy);
    if (distToCorridor(segs, wx, wy) <= CORRIDOR_CLEAR) continue;
    spots.push({ x: wx + 0.5, y: wy + 0.5 });
  }
  return spots;
}
