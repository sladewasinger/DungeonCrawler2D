import {
  CHUNK_SIZE,
  MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
} from "@dc2d/engine";

export interface MiniBossArenaChunkCoordinates {
  readonly cx: number;
  readonly cy: number;
}

export interface WorldPosition {
  readonly x: number;
  readonly y: number;
}

export function chunkAt(position: WorldPosition): MiniBossArenaChunkCoordinates {
  return {
    cx: Math.floor(position.x / CHUNK_SIZE),
    cy: Math.floor(position.y / CHUNK_SIZE),
  };
}

export function compassWindowChunks(
  center: MiniBossArenaChunkCoordinates,
): MiniBossArenaChunkCoordinates[] {
  return chunkRectangle({
    minimum: {
      cx: center.cx - MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
      cy: center.cy - MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
    },
    maximum: {
      cx: center.cx + MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
      cy: center.cy + MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
    },
  });
}

export function chunksWithinTileRadius(
  position: WorldPosition,
  radiusTiles: number,
): MiniBossArenaChunkCoordinates[] {
  return chunkRectangle({
    minimum: chunkAt({ x: position.x - radiusTiles, y: position.y - radiusTiles }),
    maximum: chunkAt({ x: position.x + radiusTiles, y: position.y + radiusTiles }),
  });
}

interface ChunkRectangle {
  readonly minimum: MiniBossArenaChunkCoordinates;
  readonly maximum: MiniBossArenaChunkCoordinates;
}

function chunkRectangle(
  rectangle: ChunkRectangle,
): MiniBossArenaChunkCoordinates[] {
  const chunks: MiniBossArenaChunkCoordinates[] = [];
  for (let cy = rectangle.minimum.cy; cy <= rectangle.maximum.cy; cy++) {
    for (let cx = rectangle.minimum.cx; cx <= rectangle.maximum.cx; cx++) {
      chunks.push({ cx, cy });
    }
  }
  return chunks;
}
