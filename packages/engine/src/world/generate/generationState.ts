import { TOPOLOGY } from "../core/types.js";
import { DEFAULT_WORLD_FEATURES, type WorldFeatures } from "../core/worldFeatures.js";
import { CHUNK_SIZE } from "../core/types.js";
import type { Room } from "./types.js";
import type { carveCorridors } from "./connections/corridors.js";
import { districtAt } from "./layout/district.js";
import { chunkSeed, layoutSeed } from "./layout/hash.js";

export interface ChunkGenerationRequest {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
  features?: WorldFeatures;
}

export interface FeatureStampContext {
  worldSeed: number;
  floor: number;
  cx: number;
  cy: number;
  tiles: Uint8Array;
  height: Float32Array;
  corridorCarved: Uint8Array;
  rooms: Room[];
}

export interface GenerationState extends FeatureStampContext {
  floorLayoutSeed: number;
  chunkLayoutSeed: number;
  district: ReturnType<typeof districtAt>;
  zones: Uint8Array;
  doorways: ReturnType<typeof carveCorridors>;
  worldFeatures: WorldFeatures;
}

function generatedGrid(): Pick<
  GenerationState,
  "tiles" | "height" | "zones" | "corridorCarved"
> {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  return {
    tiles: new Uint8Array(cells).fill(TOPOLOGY.Uncarved),
    height: new Float32Array(cells),
    zones: new Uint8Array(cells),
    corridorCarved: new Uint8Array(cells),
  };
}

export function createGenerationState(request: ChunkGenerationRequest): GenerationState {
  const floorLayoutSeed = layoutSeed(request.worldSeed, request.floor);
  const { features, ...location } = request;
  return {
    ...location,
    ...generatedGrid(),
    worldFeatures: features ?? DEFAULT_WORLD_FEATURES,
    floorLayoutSeed,
    chunkLayoutSeed: chunkSeed(floorLayoutSeed, request.cx, request.cy),
    district: districtAt(floorLayoutSeed, request.cx, request.cy),
    rooms: [],
    doorways: [],
  };
}
