import { hash2D, mixSeeds } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "./fixed.js";
import { hasPlatformCluster } from "./platforms.js";
import {
  CORRIDOR_HALF_WIDTH,
  chunkCenter,
  distToCorridor,
  seedsFor,
  type CorridorSegment,
} from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";

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

export const TERRACE_RISE = 1;
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
 * platform clusters, before pocket sealing). The whole rect rises
 * TERRACE_RISE (cave walls inside ride up with the ground); entry
 * steps at TERRACE_RISE/2 are then placed one tile OUTSIDE the
 * boundary where the corridor crosses it — the rect's outline stays an
 * unbroken straight edge and the staircase object leans against it
 * from the low ground, exactly like the pack's sample map (never
 * recessed into an alcove). Steps are EXACTLY as wide as the object
 * each one wears (render/stairsprites.ts): south entries 2 tiles (the
 * 2×3 south-face staircase), east/west entries 1 tile (the wedges). NO
 * north entries: a staircase climbing north→south would stand hidden
 * behind the platform (the pack has no such sprite) — north edges are
 * drop-off ledges you leave, not enter.
 */
interface TerraceRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function stampTerraceRect(rect: TerraceRect, height: Float32Array): void {
  for (let ly = rect.y0; ly <= rect.y1; ly++) {
    for (let lx = rect.x0; lx <= rect.x1; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      height[ly * CHUNK_SIZE + lx] = TERRACE_RISE;
    }
  }
}

/** Carve one centered, object-width entry step into a run of qualifying cells. */
function flushEntryRun(run: Array<[number, number]>, want: number, tiles: Uint8Array, height: Float32Array): void {
  if (run.length === 0) return;
  const w = Math.min(want, run.length);
  const start = Math.floor((run.length - w) / 2);
  for (let k = start; k < start + w; k++) {
    const cell = run[k];
    if (!cell) continue;
    const [lx, ly] = cell;
    const i = ly * CHUNK_SIZE + lx;
    tiles[i] = TILE.Stairs;
    height[i] = TERRACE_RISE / 2;
  }
}

/** True where a boundary cell is a corridor crossing eligible for an entry step. */
function isEntryCell(
  segs: CorridorSegment[],
  cx: number,
  cy: number,
  tiles: Uint8Array,
  lx: number,
  ly: number,
  insideDx: number,
  insideDy: number,
): boolean {
  const inChunk = lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
  if (!inChunk) return false;
  const onCorridor =
    distToCorridor(segs, cx * CHUNK_SIZE + lx, cy * CHUNK_SIZE + ly) <= CORRIDOR_HALF_WIDTH;
  return (
    onCorridor &&
    tiles[ly * CHUNK_SIZE + lx] === TILE.Floor &&
    tiles[(ly + insideDy) * CHUNK_SIZE + (lx + insideDx)] === TILE.Floor
  );
}

/**
 * Place one centered, object-width entry step per contiguous corridor
 * crossing of an edge — on the low tile just outside it. Both the step
 * tile and the boundary tile BEHIND it (insideDx/Dy) must be floor: no
 * steps against cave walls, no steps to nowhere.
 */
function carveEntryEdge(
  cells: Array<[number, number]>,
  want: number,
  insideDx: number,
  insideDy: number,
  segs: CorridorSegment[],
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
): void {
  let run: Array<[number, number]> = [];
  for (const [lx, ly] of cells) {
    if (isEntryCell(segs, cx, cy, tiles, lx, ly, insideDx, insideDy)) {
      run.push([lx, ly]);
    } else {
      flushEntryRun(run, want, tiles, height);
      run = [];
    }
  }
  flushEntryRun(run, want, tiles, height);
}

function edgeCells(rect: TerraceRect): {
  south: Array<[number, number]>;
  east: Array<[number, number]>;
  west: Array<[number, number]>;
} {
  const south: Array<[number, number]> = [];
  for (let lx = rect.x0 + 1; lx <= rect.x1 - 1; lx++) south.push([lx, rect.y1 + 1]);
  const east: Array<[number, number]> = [];
  const west: Array<[number, number]> = [];
  for (let ly = rect.y0 + 1; ly <= rect.y1 - 1; ly++) {
    east.push([rect.x1 + 1, ly]);
    west.push([rect.x0 - 1, ly]);
  }
  return { south, east, west };
}

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
  const rect: TerraceRect = {
    x0: spec.lx - spec.hx,
    x1: spec.lx + spec.hx,
    y0: spec.ly - spec.hy,
    y1: spec.ly + spec.hy,
  };
  stampTerraceRect(rect, height);

  const { south, east, west } = edgeCells(rect);
  carveEntryEdge(south, 2, 0, -1, segs, cx, cy, tiles, height);
  carveEntryEdge(east, 1, -1, 0, segs, cx, cy, tiles, height);
  carveEntryEdge(west, 1, 1, 0, segs, cx, cy, tiles, height);
}
