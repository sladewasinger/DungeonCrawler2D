// Active district generator. Ordinary terrain is planned across a 3×3 group
// of runtime chunks, finalized as one surface, then sliced into 32×32 chunks.

import type { Chunk } from "../core/types.js";
import { DEFAULT_WORLD_FEATURES } from "../core/worldFeatures.js";
import { generateRoomChunk, isRoomChunk } from "../features/rooms/rooms.js";
import { generateDistrictChunks as generateTerrainDistrict } from "./district/districtGeneration.js";
import type { ChunkGenerationRequest } from "./generationState.js";
import { assertChunkWorldFeatures } from "./worldFeatureInvariant.js";

export type { ChunkGenerationRequest } from "./generationState.js";

function generateSpecialRoom(request: ChunkGenerationRequest): Chunk {
  const features = request.features ?? DEFAULT_WORLD_FEATURES;
  const room = generateRoomChunk(request.cx, request.cy, features.voidTerrain);
  return assertChunkWorldFeatures(room, features);
}

export function generateDistrictChunks(
  request: ChunkGenerationRequest,
): readonly Chunk[] {
  if (isRoomChunk(request.cy)) return [generateSpecialRoom(request)];
  // The final dungeon district overlaps the reserved room band numerically.
  // Never let its batched cache payload replace independently generated rooms.
  return generateTerrainDistrict(request).filter((chunk) => {
    return !isRoomChunk(chunk.cy);
  });
}

export function generateChunk(request: ChunkGenerationRequest): Chunk {
  const chunks = generateDistrictChunks(request);
  const match = chunks.find((chunk) => {
    return chunk.cx === request.cx && chunk.cy === request.cy;
  });
  if (!match) {
    throw new Error(`District generation omitted chunk (${request.cx}, ${request.cy})`);
  }
  return match;
}
