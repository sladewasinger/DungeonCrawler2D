import { CHUNK_SIZE, isRoomIsolationChunk } from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  OUTSIDE_TERRAIN_PRESENTATION,
  type TerrainPlan,
  type TerrainRect,
  type TerrainSource,
} from "./terrainPlanner.js";
import { emptyTerrainBatches } from "./visibility/visibleTerrainBatches.js";

export interface FiniteChunkInput {
  readonly source: TerrainSource;
  readonly coord: { readonly cx: number; readonly cy: number };
  readonly orientation: ViewOrientation;
}

export function chunkBounds(coord: FiniteChunkInput["coord"]): TerrainRect {
  return { x: coord.cx * CHUNK_SIZE, y: coord.cy * CHUNK_SIZE, width: CHUNK_SIZE, height: CHUNK_SIZE };
}

export function chunkIntersectsFiniteBounds(
  coord: FiniteChunkInput["coord"],
  finiteBounds: TerrainRect | undefined,
): boolean {
  if (!finiteBounds || isRoomIsolationChunk(coord.cy)) return true;
  const chunk = chunkBounds(coord);
  return chunk.x < finiteBounds.x + finiteBounds.width &&
    chunk.x + chunk.width > finiteBounds.x &&
    chunk.y < finiteBounds.y + finiteBounds.height &&
    chunk.y + chunk.height > finiteBounds.y;
}

export function emptyPlanForChunk(input: FiniteChunkInput): TerrainPlan {
  const bounds = chunkBounds(input.coord);
  return {
    bounds,
    sampleBounds: bounds,
    orientation: input.orientation,
    presentation: OUTSIDE_TERRAIN_PRESENTATION,
    batches: emptyTerrainBatches(),
  };
}
