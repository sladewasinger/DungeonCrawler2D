// Finite dungeon generation facade. Layout is completed once per floor and
// runtime chunks are immutable slices of that completed model.

import type { Chunk } from "../core/types.js";
import {
  generateFiniteFloor,
  finiteFloorForRuntime,
  sliceGeneratedFloorChunk,
  type GeneratedFloor,
} from "./finiteFloor.js";
import { projectLegacySafeRoomKiosk } from "./finiteFloorChunk.js";
import {
  generateRoomChunk,
  isRoomIsolationChunk,
} from "../features/rooms/rooms.js";
import type { ChunkGenerationRequest } from "./generationState.js";

export type { ChunkGenerationRequest } from "./generationState.js";
export {
  DEFAULT_FLOOR_GENERATION_CONFIG,
  FINITE_GENERATOR_VERSION,
  FLOOR_SEMANTIC,
  clearFiniteFloorCache,
  floorBiomeAt,
  floorTerritoryAt,
  floorDebugExport,
  floorFeatureAt,
  clampFiniteFloorPosition,
  FINITE_NOCLIP_EDGE_MARGIN,
  generateFiniteFloor,
  generateFiniteFloorTrace,
  DEFAULT_TERRITORY_ROSTER,
  TERRITORY_IDS,
  isTerritoryId,
  territoryProfile,
  sliceGeneratedFloorChunk,
} from "./finiteFloor.js";
export type {
  FloorBounds,
  FloorGenerationConfig,
  FloorGenerationTraceConfig,
  FloorGenerationTraceRequest,
  FloorGenerationIdentity,
  GeneratedBossArena,
  GeneratedConnector,
  GeneratedFeatureStamp,
  GeneratedFloor,
  GeneratedTerritoryLayout,
  GeneratedMiniBossArena,
  GeneratedMiniBossGate,
  GeneratedRoom,
  GeneratedSafeRoomEntrance,
  GeneratedStairway,
  GeneratedFloorTrace,
  FloorGenerationSnapshot,
  FloorGenerationStageId,
  FloorGenerationTrace,
  NormalizedFloorGenerationConfig,
  TerritoryId,
  TerritoryLayoutSignature,
  TerritoryProfile,
} from "./finiteFloor.js";
export {
  createFiniteFloorArtifact,
  restoreFiniteFloorArtifact,
  FINITE_FLOOR_ARTIFACT_PLANES,
  FINITE_FLOOR_ARTIFACT_VERSION,
} from "./artifact/finiteFloorArtifact.js";
export type { FiniteFloorArtifact, FiniteFloorArtifactPlane } from "./artifact/finiteFloorArtifact.js";

export function generatedFloorFor(request: ChunkGenerationRequest): GeneratedFloor {
  return generateFiniteFloor(request);
}

export function generateDistrictChunks(
  request: ChunkGenerationRequest,
): readonly Chunk[] {
  const floor = finiteFloorForRuntime(request);
  const originCx = Math.floor(request.cx / 3) * 3;
  const originCy = Math.floor(request.cy / 3) * 3;
  return [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => sliceGeneratedFloorChunk(floor, originCx + dx, originCy + dy)));
}

export function generateChunk(request: ChunkGenerationRequest): Chunk {
  if (isRoomIsolationChunk(request.cy)) return generateRoomChunk(request.cx, request.cy);
  const floor = finiteFloorForRuntime(request);
  return projectLegacySafeRoomKiosk(floor, sliceGeneratedFloorChunk(floor, request.cx, request.cy));
}
