import { TOPOLOGY } from "../../core/types.js";
import { DEFAULT_WORLD_FEATURES, type WorldFeatures } from "../../core/worldFeatures.js";
import type { ChunkGenerationRequest } from "../generationState.js";
import {
  districtAt,
  districtCoordinateForChunk,
  districtOriginForChunk,
  DISTRICT_TILE_SPAN,
  type DistrictCoordinate,
  type DistrictKind,
  type DistrictOrigin,
} from "../layout/district.js";
import { districtSeed, layoutSeed } from "../layout/hash.js";
import type { Doorway, Room } from "../types.js";

export interface DistrictTerrainBuffers {
  readonly tiles: Uint8Array;
  readonly featureTiles: Uint8Array;
  readonly featureFaces: Uint8Array;
  readonly featureHeight: Float32Array;
  readonly height: Float32Array;
  readonly zones: Uint8Array;
  readonly corridorCarved: Uint8Array;
}

export interface DistrictGenerationState extends DistrictTerrainBuffers {
  readonly worldSeed: number;
  readonly floor: number;
  readonly floorLayoutSeed: number;
  readonly districtLayoutSeed: number;
  readonly coordinate: DistrictCoordinate;
  readonly origin: DistrictOrigin;
  readonly district: DistrictKind;
  readonly worldFeatures: WorldFeatures;
  rooms: Room[];
  doorways: Doorway[];
}

function createDistrictBuffers(): DistrictTerrainBuffers {
  const cells = DISTRICT_TILE_SPAN * DISTRICT_TILE_SPAN;
  return {
    tiles: new Uint8Array(cells).fill(TOPOLOGY.Uncarved),
    featureTiles: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells),
    height: new Float32Array(cells),
    zones: new Uint8Array(cells),
    corridorCarved: new Uint8Array(cells),
  };
}

export function createDistrictState(
  request: ChunkGenerationRequest,
): DistrictGenerationState {
  const floorLayoutSeed = layoutSeed(request.worldSeed, request.floor);
  const coordinate = districtCoordinateForChunk(request.cx, request.cy);
  const origin = districtOriginForChunk(request.cx, request.cy);
  return {
    worldSeed: request.worldSeed,
    floor: request.floor,
    floorLayoutSeed,
    districtLayoutSeed: districtSeed(
      floorLayoutSeed,
      coordinate.dx,
      coordinate.dy,
    ),
    coordinate,
    origin,
    district: districtAt(floorLayoutSeed, request.cx, request.cy),
    worldFeatures: request.features ?? DEFAULT_WORLD_FEATURES,
    ...createDistrictBuffers(),
    rooms: [],
    doorways: [],
  };
}
