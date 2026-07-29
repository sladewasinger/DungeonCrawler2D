// Chunk-authored structures projected onto a district terrain slice. These
// placements intentionally retain their 32×32 runtime-chunk contracts.

import { applyBossArena } from "../features/bossArena/bossArena.js";
import { applyDescentStructure } from "../features/descent/descent.js";
import {
  applyFlattenedFeature,
  isSafeRoomChunk,
  isStairsChunk,
} from "../features/fixed/fixed.js";
import { connectBossArenaGate } from "./connections/bossArenaLink.js";
import { connectDescentStructure } from "./connections/descentLink.js";
import { connectFixedFeaturePad } from "./connections/feature-link.js";
import type { ChunkFeatureState } from "./generationState.js";
import { applyLandmark } from "./landmarks/index.js";
import type { Point } from "./types.js";

function stampDescentFeature(state: ChunkFeatureState): void {
  const exit = applyDescentStructure({
    chunk: state,
    tiles: state.tiles,
    height: state.height,
  });
  if (!exit) return;
  connectDescentStructure({
    tiles: state.tiles,
    corridorCarved: state.corridorCarved,
    height: state.height,
    exit: { x: exit.lx, y: exit.ly },
    rooms: state.rooms,
  });
}

function stampBossArenaFeature(state: ChunkFeatureState): void {
  const arena = applyBossArena({
    chunk: state,
    tiles: state.tiles,
    height: state.height,
  });
  if (!arena) return;
  const gate: Point = { x: arena.gate.lx, y: arena.gate.ly };
  const center: Point = { x: arena.center.lx, y: arena.center.ly };
  connectBossArenaGate({
    tiles: state.tiles,
    corridorCarved: state.corridorCarved,
    height: state.height,
    gate,
    center,
    rooms: state.rooms,
  });
  applyBossArena({
    chunk: state,
    tiles: state.tiles,
    height: state.height,
  });
}

function stampFixedFeature(state: ChunkFeatureState): void {
  if (!isSafeRoomChunk(state) && !isStairsChunk(state)) return;
  const before = state.tiles.slice();
  applyFlattenedFeature({
    chunk: state,
    tiles: state.tiles,
    featureTiles: state.featureTiles,
    featureFaces: state.featureFaces,
    featureHeight: state.featureHeight,
    height: state.height,
  });
  connectFixedFeaturePad({
    tiles: state.tiles,
    corridorCarved: state.corridorCarved,
    before,
    rooms: state.rooms,
  });
}

export function stampChunkFeatures(state: ChunkFeatureState): void {
  stampFixedFeature(state);
  stampDescentFeature(state);
  stampBossArenaFeature(state);
  applyLandmark({
    ...state,
    seed: state.floorLayoutSeed,
    kind: state.district,
  });
}
