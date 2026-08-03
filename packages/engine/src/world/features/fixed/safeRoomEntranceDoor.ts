import { CHUNK_SIZE } from "../../core/types.js";
import type { GeneratedFloor } from "../../generate/finiteFloor.js";

/** Pure world-space location of the safe-room door authored for a chunk. */
export function safeRoomEntranceDoorForChunk(
  floor: Pick<GeneratedFloor, "safeRooms"> | null,
  cx: number,
  cy: number,
): { readonly x: number; readonly y: number } | null {
  const room = floor?.safeRooms.find((site) =>
    Math.floor(site.door.x / CHUNK_SIZE) === cx &&
    Math.floor(site.door.y / CHUNK_SIZE) === cy,
  );
  if (!room) return null;
  return {
    x: room.door.x,
    y: room.door.y,
  };
}
