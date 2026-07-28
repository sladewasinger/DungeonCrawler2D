// Active room-and-corridor generator. Composes BSP rooms, cross-chunk
// corridors, districts, landmarks, deliberate height, and fixed features
// into one pure, chunk-local, byte-deterministic chunk.

import { applyBossArena } from "../features/bossArena/bossArena.js";
import { applyDescentStructure } from "../features/descent/descent.js";
import { applyFlattenedFeature, isSafeRoomChunk, isStairsChunk } from "../features/fixed/fixed.js";
import { generateRoomChunk, isRoomChunk } from "../features/rooms/rooms.js";
import { sealInteriorPockets } from "../core/pockets.js";
import { CHUNK_SIZE, type Chunk } from "../core/types.js";
import { partitionChunk } from "./layout/bsp.js";
import { connectBossArenaGate } from "./connections/bossArenaLink.js";
import { demoteOrphanedStairs, repairCliffs } from "./terrain/cliffs.js";
import { carveCorridors } from "./connections/corridors.js";
import { connectDescentStructure } from "./connections/descentLink.js";
import { edgeAnchors } from "./layout/edges.js";
import { connectFixedFeaturePad } from "./connections/feature-link.js";
import { applyRoomHeight, markVoidTiles } from "./terrain/height.js";
import { DEFAULT_WORLD_FEATURES } from "../core/worldFeatures.js";
import { applyLandmark } from "./landmarks/index.js";
import { isNearDescent, isNearLandmark } from "./landmarks/guard.js";
import { stampRoom } from "./layout/rooms.js";
import type { Point, Room } from "./types.js";
import { applyShowcase } from "./showcase/showcase.js";
import { resolveShallowPlateaus, resolveThinWalls } from "./terrain/verticalExtent.js";
import { applyWallHeight } from "./terrain/wallHeight.js";
import { buildRuntimeChunk } from "./runtimeChunk.js";
import { assertChunkWorldFeatures } from "./worldFeatureInvariant.js";
import { createGenerationState, type ChunkGenerationRequest, type FeatureStampContext, type GenerationState } from "./generationState.js";

export type { ChunkGenerationRequest } from "./generationState.js";

function finalizeRuntimeChunk(chunk: Chunk): Chunk {
  demoteOrphanedStairs(chunk.tiles, chunk.height, CHUNK_SIZE);
  // Runtime VOID cells are already heightless; enforce the same z+1 depth rule
  // for the remaining finite terrain after topology-to-height-map conversion.
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
  applyFlattenedFeature({
    chunk,
    tiles: context.tiles,
    height: context.height,
  });
  connectFixedFeaturePad({ tiles: context.tiles, corridorCarved: context.corridorCarved, before, rooms: context.rooms });
}

export function generateChunk(request: ChunkGenerationRequest): Chunk {
  const worldFeatures = request.features ?? DEFAULT_WORLD_FEATURES;
  if (isRoomChunk(request.cy)) {
    const room = generateRoomChunk(request.cx, request.cy, worldFeatures.voidTerrain);
    return assertChunkWorldFeatures(room, worldFeatures);
  }
  const state = createGenerationState(request);
  stampRoomsAndCorridors(state);
  applyRoomHeights(state);
  stampFeatures(state);
  finishTerrain(state);
  return assertChunkWorldFeatures(assembleRuntimeChunk(state), worldFeatures);
}

function stampRoomsAndCorridors(state: GenerationState): void {
  const layout = partitionChunk(state.chunkLayoutSeed, CHUNK_SIZE, state.district);
  state.rooms = layout.rooms;
  for (const room of state.rooms) {
    stampRoom({
      tiles: state.tiles,
      chunkSize: CHUNK_SIZE,
      room,
      seed: state.chunkLayoutSeed,
    });
  }
  state.doorways = carveCorridors({
    seed: state.chunkLayoutSeed, tiles: state.tiles, corridorCarved: state.corridorCarved,
    chunkSize: CHUNK_SIZE, rooms: state.rooms, links: layout.links,
    anchors: edgeAnchors({
      seed: state.floorLayoutSeed,
      cx: state.cx,
      cy: state.cy,
      chunkSize: CHUNK_SIZE,
    }),
  });
}

function applyRoomHeights(state: GenerationState): void {
  for (const room of state.rooms) applyHeightIfUnguarded(state, room);
}

function applyHeightIfUnguarded(state: GenerationState, room: Room): void {
  const guard = { worldSeed: state.worldSeed, floor: state.floor, cx: state.cx, cy: state.cy, rect: room.rect };
  if (isNearLandmark(guard) || isNearDescent(guard)) return;
  applyRoomHeight({
    ...state,
    room,
    doorways: state.doorways,
    seed: state.chunkLayoutSeed,
    chunkSize: CHUNK_SIZE,
  });
}

function stampFeatures(state: GenerationState): void {
  stampFixedFeature(state);
  stampDescentFeature(state);
  stampBossArenaFeature(state);
  applyLandmark({
    ...state,
    seed: state.floorLayoutSeed,
    kind: state.district,
  });
  repairCliffs(state.tiles, state.height, CHUNK_SIZE);
}

function finishTerrain(state: GenerationState): void {
  sealInteriorPockets(state.tiles, state.corridorCarved, state.zones);
  resolveThinWalls(state.tiles, CHUNK_SIZE);
  repairCliffs(state.tiles, state.height, CHUNK_SIZE);
  resolveShallowPlateaus(state.tiles, state.height, CHUNK_SIZE);
  if (state.worldFeatures.voidTerrain) {
    markVoidTiles(state.tiles, state.height, CHUNK_SIZE);
  }
  applyWallHeight(state.tiles, state.height, CHUNK_SIZE);
  demoteOrphanedStairs(state.tiles, state.height, CHUNK_SIZE);
}

function assembleRuntimeChunk(state: GenerationState): Chunk {
  applyShowcase({
    worldSeed: state.worldSeed, floor: state.floor, cx: state.cx, cy: state.cy,
    tiles: state.tiles, height: state.height, zones: state.zones,
    voidTerrain: state.worldFeatures.voidTerrain,
  });
  const runtimeChunk = buildRuntimeChunk(state.cx, state.cy, {
    ...state,
    worldFeatures: state.worldFeatures,
  });
  return finalizeRuntimeChunk(runtimeChunk);
}
