import type { WorldFeatures } from "../core/worldFeatures.js";
import type { Room } from "./types.js";
import { districtAt } from "./layout/district.js";

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
  featureTiles: Uint8Array;
  featureFaces: Uint8Array;
  featureHeight: Float32Array;
  height: Float32Array;
  corridorCarved: Uint8Array;
  rooms: Room[];
}

export interface ChunkFeatureState extends FeatureStampContext {
  floorLayoutSeed: number;
  district: ReturnType<typeof districtAt>;
  zones: Uint8Array;
}
