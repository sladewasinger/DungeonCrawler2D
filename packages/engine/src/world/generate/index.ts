// "Architect" room-and-corridor generator (docs/PORT_PLAN.md's worldgen
// redesign brief), grafted with the winning judge-suggested pieces from the
// other two candidates: super-chunk DISTRICT character (bsp.ts, district.ts),
// AVENUE-widened cross-chunk corridors at district seams (edges.ts), one
// LANDMARK set-piece per super-chunk (landmarks/), and rare deep CHASM rifts
// with a guaranteed bridge (height.ts). Composes BSP room layout, corridor
// carving, deliberate height, and the shared fixed-feature/pocket-sealing
// machinery into one chunk. Same contract as world/generate.ts: pure,
// chunk-local, byte-deterministic.

import { applyBossArena } from "../features/bossArena.js";
import { applyDescentStructure } from "../features/descent.js";
import { applyFlattenedFeature, isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { generateRoomChunk, isRoomChunk } from "../features/rooms.js";
import { sealInteriorPockets } from "../pockets.js";
import { seedsFor } from "../terrain.js";
import { CHUNK_SIZE, TILE, type Chunk } from "../types.js";
import { partitionChunk } from "./bsp.js";
import { connectBossArenaGate } from "./bossArenaLink.js";
import { demoteOrphanedStairs, repairCliffs } from "./cliffs.js";
import { carveCorridors } from "./corridors.js";
import { connectDescentStructure } from "./descentLink.js";
import { districtAt } from "./district.js";
import { edgeAnchors } from "./edges.js";
import { connectFixedFeaturePad } from "./feature-link.js";
import { applyRoomHeight } from "./height.js";
import { architectSeed, chunkSeed } from "./hash.js";
import { applyLandmark } from "./landmarks/index.js";
import { isNearDescent, isNearLandmark } from "./landmarks/guard.js";
import { stampRoom } from "./rooms.js";
import type { Point, Room } from "./types.js";
import { resolveShallowPlateaus, resolveThinWalls } from "./verticalExtent.js";
import { applyWallHeight } from "./wallHeight.js";

/**
 * StairwayUp/StairwayDown (features/descent.ts): stamp, then connect via
 * descentLink.ts's height-flattening connector — feature-link.ts's generic
 * connectFixedFeaturePad (used below for safe rooms/stairs) only rewrites
 * TILE type, which is provably insufficient here (descentLink.ts's own doc
 * comment; regression-locked by generate/descentInvariant.test.ts).
 */
function stampDescentFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  corridorCarved: Uint8Array,
  rooms: Room[],
): void {
  const exit = applyDescentStructure(worldSeed, floor, cx, cy, tiles, height);
  if (exit) connectDescentStructure(tiles, corridorCarved, height, { x: exit.lx, y: exit.ly }, rooms);
}

/**
 * Floor FLOOR_CAP's sealed boss arena (features/bossArena.ts): stamp, route
 * its one gate to the network (bossArenaLink.ts's provably-safe 3-leg
 * route), then re-stamp the ring as a cheap defensive backstop — the
 * connector legs may pass through the arena's own INTERIOR on their way
 * (harmless; already floor), and this guarantees the boundary ring itself
 * ends exactly where the first stamp put it regardless.
 */
function stampBossArenaFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  corridorCarved: Uint8Array,
  rooms: Room[],
): void {
  const arena = applyBossArena(worldSeed, floor, cx, cy, tiles, height);
  if (!arena) return;
  const gate: Point = { x: arena.gate.lx, y: arena.gate.ly };
  const center: Point = { x: arena.center.lx, y: arena.center.ly };
  connectBossArenaGate(tiles, corridorCarved, height, gate, center, rooms);
  applyBossArena(worldSeed, floor, cx, cy, tiles, height);
}

function stampFixedFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
  corridorCarved: Uint8Array,
  rooms: Room[],
): void {
  if (!isSafeRoomChunk(worldSeed, floor, cx, cy) && !isStairsChunk(worldSeed, floor, cx, cy)) return;
  const before = tiles.slice();
  // Default fixed-feature helper only reads seeds.layout and never the
  // corridor segments (its height sample is always 0 — flat-first here
  // too), so an empty segment list is a legitimate read-only reuse.
  applyFlattenedFeature(worldSeed, floor, cx, cy, seedsFor(worldSeed, floor), [], tiles, height, zones);
  connectFixedFeaturePad(tiles, corridorCarved, before, rooms);
}

export function generateChunk(worldSeed: number, floor: number, cx: number, cy: number): Chunk {
  // Stretch rooms (personal/party/safe) are reserved instanced geometry far
  // below the playable floor — untouched by the room generator.
  if (isRoomChunk(cy)) return generateRoomChunk(cx, cy);

  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE.Wall);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const zones = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const corridorCarved = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  const seed = architectSeed(worldSeed, floor);
  const perChunkSeed = chunkSeed(seed, cx, cy);
  const district = districtAt(seed, cx, cy);
  const { rooms, links } = partitionChunk(perChunkSeed, CHUNK_SIZE, district);
  for (const room of rooms) stampRoom(tiles, CHUNK_SIZE, room, perChunkSeed);

  const anchors = edgeAnchors(seed, cx, cy, CHUNK_SIZE);
  const doorways = carveCorridors(perChunkSeed, tiles, corridorCarved, CHUNK_SIZE, rooms, links, anchors);

  for (const room of rooms) {
    // A room the landmark stamp is about to overwrite (or graze) never
    // gets its own pit/dais/chasm ring — see landmarks/guard.ts.
    if (isNearLandmark(worldSeed, floor, cx, cy, room.rect)) continue;
    if (isNearDescent(worldSeed, floor, cx, cy, room.rect)) continue;
    applyRoomHeight(perChunkSeed, tiles, height, corridorCarved, CHUNK_SIZE, room, doorways);
  }

  stampFixedFeature(worldSeed, floor, cx, cy, tiles, height, zones, corridorCarved, rooms);
  stampDescentFeature(worldSeed, floor, cx, cy, tiles, height, corridorCarved, rooms);
  stampBossArenaFeature(worldSeed, floor, cx, cy, tiles, height, corridorCarved, rooms);
  applyLandmark(district, seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height);
  repairCliffs(tiles, height, CHUNK_SIZE);

  sealInteriorPockets(tiles, corridorCarved, zones);
  // Vertical-extent safety net (docs/VISUAL_DIRECTION.md's z+1 rule), run
  // last on the final tile/height layout so it catches violations from
  // every earlier source at once — including ones sealInteriorPockets just
  // introduced by walling off a single stray tile. resolveThinWalls can
  // open new floor-floor seams (a merged wall meeting a differently-heighted
  // neighbor), so repairCliffs runs once more after it to smooth those.
  resolveThinWalls(tiles, CHUNK_SIZE);
  repairCliffs(tiles, height, CHUNK_SIZE);
  resolveShallowPlateaus(tiles, height, CHUNK_SIZE);

  applyWallHeight(tiles, height, CHUNK_SIZE);
  // Run LAST, after the wall-height raise: a Stairs tile's climb axis can
  // depend on a neighboring Wall's height, which only reaches its real
  // (post-raise) value here — checking any earlier would validate against
  // heights no player ever actually sees (see cliffs.ts's doc comment).
  demoteOrphanedStairs(tiles, height, CHUNK_SIZE);

  return { cx, cy, tiles, height, zones };
}
