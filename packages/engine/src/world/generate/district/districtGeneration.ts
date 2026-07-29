import { CHUNK_SIZE, type Chunk } from "../../core/types.js";
import { applyMiniBossArena } from "../../features/miniBossArena/miniBossArenaStamp.js";
import { applySpawnRoomExterior } from "../../features/rooms/spawnExterior/spawnRoomExteriorStamp.js";
import { stampChunkFeatures } from "../featureStamps.js";
import { connectSpawnRoomExterior } from "../connections/spawnRoomExteriorLink.js";
import type { ChunkGenerationRequest } from "../generationState.js";
import { buildRuntimeChunk, type GeneratedTerrain } from "../runtimeChunk.js";
import { applyShowcase } from "../showcase/showcase.js";
import { assertChunkWorldFeatures } from "../worldFeatureInvariant.js";
import { DISTRICT_TILE_SPAN } from "../layout/district.js";
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

function stampSpawnRoomExterior(
  state: DistrictGenerationState,
): void {
  const before = state.tiles.slice();
  const context = {
    floor: state.floor,
    voidTerrain: state.worldFeatures.voidTerrain,
    originWorldX: state.origin.cx * CHUNK_SIZE,
    originWorldY: state.origin.cy * CHUNK_SIZE,
    size: DISTRICT_TILE_SPAN,
    tiles: state.tiles,
    featureTiles: state.featureTiles,
    featureFaces: state.featureFaces,
    featureHeight: state.featureHeight,
    height: state.height,
    corridorCarved: state.corridorCarved,
  };
  const placement = applySpawnRoomExterior(context);
  if (!placement) return;
  connectSpawnRoomExterior({ ...context, before, ...placement });
  applySpawnRoomExterior(context);
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
  stampMiniBossArena(state, coordinate, terrain);
  const chunk = buildRuntimeChunk(coordinate.cx, coordinate.cy, terrain);
  return assertChunkWorldFeatures(chunk, state.worldFeatures);
}

function stampMiniBossArena(
  state: DistrictGenerationState,
  coordinate: ChunkCoordinate,
  terrain: GeneratedTerrain,
): void {
  const featureTiles = terrain.featureTiles;
  const featureFaces = terrain.featureFaces;
  const featureHeight = terrain.featureHeight;
  if (!featureTiles || !featureFaces || !featureHeight) {
    throw new Error("District terrain omitted authored feature planes");
  }
  applyMiniBossArena({
    worldSeed: state.worldSeed,
    floor: state.floor,
    ...coordinate,
    tiles: terrain.tiles,
    featureTiles,
    featureFaces,
    featureHeight,
    height: terrain.height,
  });
}

export function generateDistrictChunks(
  request: ChunkGenerationRequest,
): readonly Chunk[] {
  const state = createDistrictState(request);
  stampDistrictTopology(state);
  applyDistrictRoomHeights(state);
  stampAuthoredFeatures(state);
  stampSpawnRoomExterior(state);
  finishDistrictTerrain(state);
  return districtChunkCoordinates(state).map((coordinate) => {
    return buildChunk(state, coordinate);
  });
}
