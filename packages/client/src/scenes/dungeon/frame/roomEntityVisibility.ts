import { CHUNK_SIZE, roomKindAt } from "@dc2d/engine";

export interface RoomEntityVisibility {
  readonly viewerX: number;
  readonly viewerY: number;
  readonly entityX: number;
  readonly entityY: number;
}

interface ChunkPosition {
  readonly cx: number;
  readonly cy: number;
}

/** Dungeon views remain global; reserved room views admit only their own chunk. */
export function isEntityVisibleFromRoom(input: RoomEntityVisibility): boolean {
  const viewerChunk = chunkAt(input.viewerX, input.viewerY);
  if (roomKindAt(viewerChunk.cx, viewerChunk.cy) === null) return true;
  return sameChunk(viewerChunk, chunkAt(input.entityX, input.entityY));
}

function chunkAt(x: number, y: number): ChunkPosition {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cy: Math.floor(y / CHUNK_SIZE),
  };
}

function sameChunk(left: ChunkPosition, right: ChunkPosition): boolean {
  return left.cx === right.cx && left.cy === right.cy;
}
