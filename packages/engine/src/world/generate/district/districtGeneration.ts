import type { Chunk } from "../../core/types.js";
import { stampChunkFeatures } from "../featureStamps.js";
import type { ChunkGenerationRequest } from "../generationState.js";
import { buildRuntimeChunk } from "../runtimeChunk.js";
import { applyShowcase } from "../showcase/showcase.js";
import { assertChunkWorldFeatures } from "../worldFeatureInvariant.js";
import { finishDistrictTerrain } from "./districtFinish.js";
import { applyDistrictRoomHeights } from "./districtHeight.js";
import {
  districtChunkCoordinates,
  extractChunkFeatureState,
  extractChunkTerrain,
  type ChunkCoordinate,
  writeChunkFeatureState,
} from "./districtSlices.js";
import {
  createDistrictState,
  type DistrictGenerationState,
} from "./districtState.js";
import { stampDistrictTopology } from "./districtTopology.js";

function stampAuthoredFeatures(state: DistrictGenerationState): void {
  for (const coordinate of districtChunkCoordinates(state)) {
    const chunk = extractChunkFeatureState(state, coordinate);
    stampChunkFeatures(chunk);
    writeChunkFeatureState(state, chunk);
  }
}

function buildChunk(
  state: DistrictGenerationState,
  coordinate: ChunkCoordinate,
): Chunk {
  const terrain = extractChunkTerrain(state, coordinate);
  applyShowcase({
    worldSeed: state.worldSeed,
    floor: state.floor,
    ...coordinate,
    tiles: terrain.tiles,
    height: terrain.height,
    zones: terrain.zones,
    voidTerrain: state.worldFeatures.voidTerrain,
  });
  const chunk = buildRuntimeChunk(coordinate.cx, coordinate.cy, terrain);
  return assertChunkWorldFeatures(chunk, state.worldFeatures);
}

export function generateDistrictChunks(
  request: ChunkGenerationRequest,
): readonly Chunk[] {
  const state = createDistrictState(request);
  stampDistrictTopology(state);
  applyDistrictRoomHeights(state);
  stampAuthoredFeatures(state);
  finishDistrictTerrain(state);
  return districtChunkCoordinates(state).map((coordinate) => {
    return buildChunk(state, coordinate);
  });
}
