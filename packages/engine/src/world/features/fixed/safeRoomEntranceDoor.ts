import { CHUNK_SIZE } from "../../core/types.js";
import type { WorldChunk } from "../descent/descentShared.js";
import { featureLayout } from "./fixed.js";

/** Pure world-space location of the safe-room door authored for a chunk. */
export function safeRoomEntranceDoorForChunk(
  chunk: WorldChunk,
): { readonly x: number; readonly y: number } | null {
  const layout = featureLayout(chunk);
  if (!layout?.safeRoom) return null;
  return {
    x: chunk.cx * CHUNK_SIZE + layout.centerLx,
    y: chunk.cy * CHUNK_SIZE + layout.centerLy + 1,
  };
}
