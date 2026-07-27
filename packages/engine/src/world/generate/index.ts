// "Architect" room-and-corridor generator (docs/PORT_PLAN.md's worldgen
// redesign brief), grafted with the winning judge-suggested pieces from the
// other two candidates: super-chunk DISTRICT character (bsp.ts, district.ts),
// AVENUE-widened cross-chunk corridors at district seams (edges.ts), one
// LANDMARK set-piece per super-chunk (landmarks/), and rare deep CHASM rifts
// with a guaranteed bridge (height.ts). Composes BSP room layout, corridor
// carving, deliberate height, and the shared fixed-feature/pocket-sealing
// machinery into one chunk. Same contract as world/generate.ts: pure,
// chunk-local, byte-deterministic.

import { applyBossArena } from "../features/bossArena/bossArena.js";
import { applyDescentStructure } from "../features/descent/descent.js";
import { applyFlattenedFeature, isSafeRoomChunk, isStairsChunk } from "../features/fixed/fixed.js";
import { generateRoomChunk, isRoomChunk } from "../features/rooms/rooms.js";
import { sealInteriorPockets } from "../core/pockets.js";
import { seedsFor } from "../core/terrain.js";
import { CHUNK_SIZE, TOPOLOGY, type Chunk } from "../core/types.js";
import { partitionChunk } from "./layout/bsp.js";
import { connectBossArenaGate } from "./connections/bossArenaLink.js";
import { demoteOrphanedStairs, repairCliffs } from "./terrain/cliffs.js";
import { carveCorridors } from "./connections/corridors.js";
import { connectDescentStructure } from "./connections/descentLink.js";
import { districtAt } from "./layout/district.js";
import { edgeAnchors } from "./layout/edges.js";
import { connectFixedFeaturePad } from "./connections/feature-link.js";
import { applyRoomHeight, markVoidTiles } from "./terrain/height.js";
import { architectSeed, chunkSeed } from "./layout/hash.js";
import { applyLandmark } from "./landmarks/index.js";
import { isNearDescent, isNearLandmark } from "./landmarks/guard.js";
import { stampRoom } from "./layout/rooms.js";
import type { Point, Room } from "./types.js";
import { applyShowcase } from "./showcase/showcase.js";
import { resolveShallowPlateaus, resolveThinWalls } from "./terrain/verticalExtent.js";
import { applyWallHeight } from "./terrain/wallHeight.js";
import { GENERATION_CHUNK_SIZE, scaleGeneratedChunk } from "./layout/scale.js";

function createGeneratedGrid(): {
  tiles: Uint8Array;
  height: Float32Array;
  zones: Uint8Array;
  corridorCarved: Uint8Array;
} {
  const cells = GENERATION_CHUNK_SIZE * GENERATION_CHUNK_SIZE;
  return {
    tiles: new Uint8Array(cells).fill(TOPOLOGY.Uncarved),
    height: new Float32Array(cells),
    zones: new Uint8Array(cells),
    corridorCarved: new Uint8Array(cells),
  };
}

function finalizeScaledChunk(chunk: Chunk): Chunk {
  demoteOrphanedStairs(chunk.tiles, chunk.height, CHUNK_SIZE);
  // Uncarved source cells become ordinary Floor surfaces at runtime; enforce
  // the same z+1 depth rule after that topology-to-height-map conversion.
  resolveShallowPlateaus(chunk.tiles, chunk.height, CHUNK_SIZE);
  demoteOrphanedStairs(chunk.tiles, chunk.height, CHUNK_SIZE);
  return chunk;
}

/**
 * StairwayUp/StairwayDown (features/descent.ts): stamp, then connect via
 * descentLink.ts's height-flattening connector — feature-link.ts's generic
 * connectFixedFeaturePad (used below for safe rooms/stairs) only rewrites
 * TILE type, which is provably insufficient here (descentLink.ts's own doc
 * comment; regression-locked by generate/descentInvariant.test.ts).
 */
interface FeatureStampContext {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
  tiles: Uint8Array;
  height: Float32Array;
  corridorCarved: Uint8Array;
  rooms: Room[];
}

function stampDescentFeature(context: FeatureStampContext): void {
  const exit = applyDescentStructure({ chunk: context, tiles: context.tiles, height: context.height });
  if (exit) {
    connectDescentStructure({
      tiles: context.tiles,
      corridorCarved: context.corridorCarved,
      height: context.height,
      exit: { x: exit.lx, y: exit.ly },
      rooms: context.rooms,
    });
  }
}

/**
 * Floor FLOOR_CAP's sealed boss arena (features/bossArena.ts): stamp, route
 * its one gate to the network (bossArenaLink.ts's provably-safe 3-leg
 * route), then re-stamp the ring as a cheap defensive backstop — the
 * connector legs may pass through the arena's own INTERIOR on their way
 * (harmless; already floor), and this guarantees the boundary ring itself
 * ends exactly where the first stamp put it regardless.
 */
function stampBossArenaFeature(context: FeatureStampContext): void {
  const arena = applyBossArena({ chunk: context, tiles: context.tiles, height: context.height });
  if (!arena) return;
  const gate: Point = { x: arena.gate.lx, y: arena.gate.ly };
  const center: Point = { x: arena.center.lx, y: arena.center.ly };
  connectBossArenaGate({ tiles: context.tiles, corridorCarved: context.corridorCarved, height: context.height, gate, center, rooms: context.rooms });
  applyBossArena({ chunk: context, tiles: context.tiles, height: context.height });
}

function stampFixedFeature(context: FeatureStampContext): void {
  const chunk = context;
  if (!isSafeRoomChunk(chunk) && !isStairsChunk(chunk)) return;
  const before = context.tiles.slice();
  // Default fixed-feature helper only reads seeds.layout and never the
  // corridor segments (its height sample is always 0 — flat-first here
  // too), so an empty segment list is a legitimate read-only reuse.
  applyFlattenedFeature({ chunk, seeds: seedsFor(context.worldSeed, context.floor), segs: [], tiles: context.tiles, height: context.height });
  connectFixedFeaturePad({ tiles: context.tiles, corridorCarved: context.corridorCarved, before, rooms: context.rooms });
}

export interface ChunkGenerationRequest {
  worldSeed: number; floor: number; cx: number; cy: number;
}

interface GenerationState extends FeatureStampContext {
  seed: number; perChunkSeed: number; district: ReturnType<typeof districtAt>;
  zones: Uint8Array; doorways: ReturnType<typeof carveCorridors>;
}

export function generateChunk(request: ChunkGenerationRequest): Chunk {
  if (isRoomChunk(request.cy)) return generateRoomChunk(request.cx, request.cy);
  const state = createGenerationState(request);
  stampRoomsAndCorridors(state);
  applyRoomHeights(state);
  stampFeatures(state);
  finishTerrain(state);
  return buildRuntimeChunk(state);
}

function createGenerationState(request: ChunkGenerationRequest): GenerationState {
  const { tiles, height, zones, corridorCarved } = createGeneratedGrid();
  const seed = architectSeed(request.worldSeed, request.floor);
  return {
    ...request, tiles, height, zones, corridorCarved, seed,
    perChunkSeed: chunkSeed(seed, request.cx, request.cy),
    district: districtAt(seed, request.cx, request.cy),
    rooms: [], doorways: [],
  };
}

function stampRoomsAndCorridors(state: GenerationState): void {
  const layout = partitionChunk(state.perChunkSeed, GENERATION_CHUNK_SIZE, state.district);
  state.rooms = layout.rooms;
  for (const room of state.rooms) stampRoom({ tiles: state.tiles, chunkSize: GENERATION_CHUNK_SIZE, room, seed: state.perChunkSeed });
  state.doorways = carveCorridors({
    seed: state.perChunkSeed, tiles: state.tiles, corridorCarved: state.corridorCarved,
    chunkSize: GENERATION_CHUNK_SIZE, rooms: state.rooms, links: layout.links,
    anchors: edgeAnchors({ seed: state.seed, cx: state.cx, cy: state.cy, chunkSize: GENERATION_CHUNK_SIZE }),
  });
}

function applyRoomHeights(state: GenerationState): void {
  for (const room of state.rooms) applyHeightIfUngarded(state, room);
}

function applyHeightIfUngarded(state: GenerationState, room: Room): void {
  const guard = { worldSeed: state.worldSeed, floor: state.floor, cx: state.cx, cy: state.cy, rect: room.rect };
  if (isNearLandmark(guard) || isNearDescent(guard)) return;
  applyRoomHeight({ ...state, room, doorways: state.doorways, seed: state.perChunkSeed, chunkSize: GENERATION_CHUNK_SIZE });
}

function stampFeatures(state: GenerationState): void {
  stampFixedFeature(state);
  stampDescentFeature(state);
  stampBossArenaFeature(state);
  applyLandmark({ ...state, kind: state.district });
  repairCliffs(state.tiles, state.height, GENERATION_CHUNK_SIZE);
}

function finishTerrain(state: GenerationState): void {
  sealInteriorPockets(state.tiles, state.corridorCarved, state.zones);
  resolveThinWalls(state.tiles, GENERATION_CHUNK_SIZE);
  repairCliffs(state.tiles, state.height, GENERATION_CHUNK_SIZE);
  resolveShallowPlateaus(state.tiles, state.height, GENERATION_CHUNK_SIZE);
  markVoidTiles(state.tiles, state.height, GENERATION_CHUNK_SIZE);
  applyWallHeight(state.tiles, state.height, GENERATION_CHUNK_SIZE);
  demoteOrphanedStairs(state.tiles, state.height, GENERATION_CHUNK_SIZE);
}

function buildRuntimeChunk(state: GenerationState): Chunk {
  applyShowcase(state.worldSeed, state.floor, state.cx, state.cy, state.tiles, state.height, state.zones);
  return finalizeScaledChunk(scaleGeneratedChunk(state.cx, state.cy, state));
}
