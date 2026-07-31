// Active district generator. Ordinary terrain is planned across a 3×3 group
// of runtime chunks, finalized as one surface, then sliced into 32×32 chunks.

import type { Chunk } from "../core/types.js";
import {
  generateRoomChunk,
  isRoomIsolationChunk,
} from "../features/rooms/rooms.js";
import { generateDistrictChunks as generateTerrainDistrict } from "./district/districtGeneration.js";
import type { ChunkGenerationRequest } from "./generationState.js";

export type { ChunkGenerationRequest } from "./generationState.js";

function generateSpecialRoom(request: ChunkGenerationRequest): Chunk {
  // Room planes keep their own sealed Bedrock apron even when ordinary dungeon
  // terrain uses the finite accessibility mode.
  return generateRoomChunk(request.cx, request.cy);
}

export function generateDistrictChunks(
  request: ChunkGenerationRequest,
): readonly Chunk[] {
  if (isRoomIsolationChunk(request.cy)) return [generateSpecialRoom(request)];
  // The final dungeon district overlaps the isolated room plane numerically.
  // Never let its batched cache payload replace rooms or their sealed buffer.
  return generateTerrainDistrict(request).filter((chunk) => {
    return !isRoomIsolationChunk(chunk.cy);
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
