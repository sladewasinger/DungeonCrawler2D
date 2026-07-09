import { hash2D, mixSeeds } from "../core/rng";
import { isSafeRoomChunk, isStairsChunk } from "./features";
import { hasPlatformCluster } from "./platforms";
import {
  CORRIDOR_HALF_WIDTH,
  chunkCenter,
  distToCorridor,
  seedsFor,
  type CorridorSegment,
} from "./terrain";
import { CHUNK_SIZE, TILE } from "./types";

/**
 * Raised sections — the "height second" feature done the deliberate
 * way: a room-sized rectangular quarter of the dungeon raised one
 * jumpable level, with hard ledges all the way around and railed
 * staircase entries carved ONLY where the corridor network crosses its
 * boundary. The section is anchored on the chunk's corridor junction,
 * so the long hallways run up onto it and through it: few points of
 * entry, each one an obvious built staircase.
 *
 * Pure per tile and confined to the chunk interior — seams and
 * determinism untouched. Mutually exclusive with ruin platform
 * clusters (those keep jump-only mesas; terraces are the walkable
 * districts).
 */

export const TERRACE_RISE = 2;
const TERRACE_MODULUS = 4; // ~1 in 4 eligible chunks

export function hasTerrace(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  // The proving ground (chunks 0..1) is authored; feature chunks keep
  // their clearings; platform-cluster chunks keep their mesas.
  if (cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1) return false;
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  if (isStairsChunk(worldSeed, floor, cx, cy)) return false;
  if (hasPlatformCluster(worldSeed, floor, cx, cy)) return false;
  const layout = seedsFor(worldSeed, floor).layout;
  return hash2D(mixSeeds(layout, 0x7e44), cx, cy) % TERRACE_MODULUS === 0;
}

export interface TerraceSpec {
  /** Chunk-local center of the raised rect. */
  lx: number;
  ly: number;
  /** Half-extents: the rect spans (lx±hx, ly±hy). */
  hx: number;
  hy: number;
}

/**
 * The section's rect, centered on the corridor junction (clamped into
 * the chunk). Junction jitter is ±6 and half-extents are ≥8, so the
 * junction always lands inside — every corridor arm must cross the
 * boundary, which is where the stair entries appear.
 */
export function terraceSpec(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): TerraceSpec | null {
  if (!hasTerrace(worldSeed, floor, cx, cy)) return null;
  const layout = seedsFor(worldSeed, floor).layout;
  const h = (salt: number) => hash2D(mixSeeds(layout, 0x7e50, salt), cx, cy);
  const hx = 8 + (h(1) % 4); // 8..11
  const hy = 8 + (h(2) % 4);
  const junction = chunkCenter(worldSeed, floor, cx, cy);
  const clamp = (v: number, half: number) =>
    Math.max(half, Math.min(CHUNK_SIZE - 1 - half, Math.round(v)));
  return {
    lx: clamp(junction.x - cx * CHUNK_SIZE, hx),
    ly: clamp(junction.y - cy * CHUNK_SIZE, hy),
    hx,
    hy,
  };
}

/**
 * Stamp the raised section over a chunk's generated data (after the
 * platform clusters, before the test zone / custom map / sealing).
 * Interior rises TERRACE_RISE; boundary-ring floor tiles on the
 * corridor become TILE.Stairs at the halfway height (one walkable step
 * to each side); cave walls inside simply ride up with the ground.
 */
export function applyTerrace(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  segs: CorridorSegment[],
  tiles: Uint8Array,
  height: Float32Array,
): void {
  const spec = terraceSpec(worldSeed, floor, cx, cy);
  if (!spec) return;
  for (let ly = spec.ly - spec.hy; ly <= spec.ly + spec.hy; ly++) {
    for (let lx = spec.lx - spec.hx; lx <= spec.lx + spec.hx; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const onRing =
        Math.abs(lx - spec.lx) === spec.hx || Math.abs(ly - spec.ly) === spec.hy;
      if (onRing && tiles[i] === TILE.Floor) {
        const wx = cx * CHUNK_SIZE + lx;
        const wy = cy * CHUNK_SIZE + ly;
        if (distToCorridor(segs, wx, wy) <= CORRIDOR_HALF_WIDTH) {
          tiles[i] = TILE.Stairs;
          height[i] = TERRACE_RISE / 2; // the entry step
          continue;
        }
      }
      height[i] = TERRACE_RISE;
    }
  }
}
