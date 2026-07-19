// "Architect" room-and-corridor generator (docs/PORT_PLAN.md's worldgen
// redesign brief), grafted with the winning judge-suggested pieces from the
// other two candidates: super-chunk DISTRICT character (bsp.ts, district.ts),
// AVENUE-widened cross-chunk corridors at district seams (edges.ts), one
// LANDMARK set-piece per super-chunk (landmarks/), and rare deep CHASM rifts
// with a guaranteed bridge (height.ts). Composes BSP room layout, corridor
// carving, deliberate height, and the shared fixed-feature/pocket-sealing
// machinery into one chunk. Same contract as world/generate.ts: pure,
// chunk-local, byte-deterministic.

import { WALL_RISE } from "../../core/constants.js";
import { applyFlattenedFeature, isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { generateRoomChunk, isRoomChunk } from "../features/rooms.js";
import { sealInteriorPockets } from "../pockets.js";
import { seedsFor } from "../terrain.js";
import { CHUNK_SIZE, TILE, type Chunk } from "../types.js";
import { partitionChunk } from "./bsp.js";
import { repairCliffs } from "./cliffs.js";
import { carveCorridors } from "./corridors.js";
import { districtAt } from "./district.js";
import { edgeAnchors } from "./edges.js";
import { connectFixedFeaturePad } from "./feature-link.js";
import { applyRoomHeight } from "./height.js";
import { architectSeed, chunkSeed } from "./hash.js";
import { applyLandmark } from "./landmarks/index.js";
import { isNearLandmark } from "./landmarks/guard.js";
import { stampRoom } from "./rooms.js";
import type { Room } from "./types.js";

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
    applyRoomHeight(perChunkSeed, tiles, height, corridorCarved, CHUNK_SIZE, room, doorways);
  }

  stampFixedFeature(worldSeed, floor, cx, cy, tiles, height, zones, corridorCarved, rooms);
  applyLandmark(district, seed, worldSeed, floor, cx, cy, corridorCarved, tiles, height);
  repairCliffs(tiles, height, CHUNK_SIZE);

  sealInteriorPockets(tiles, corridorCarved, zones);

  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall) height[i] = (height[i] ?? 0) + WALL_RISE;
  }

  return { cx, cy, tiles, height, zones };
}
