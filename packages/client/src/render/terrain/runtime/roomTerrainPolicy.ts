import { CHUNK_SIZE, isRoomChunk } from "@dc2d/engine";
import type { VoidBoundaryStyle } from "../geometry/terrainPlannerModel.js";

/**
 * Instanced rooms use VOID as an invisible collision shell. Their floor edge
 * must therefore stay flush instead of receiving the overworld's ledge art.
 */
export function roomVoidBoundaryStyle(worldY: number): VoidBoundaryStyle {
  return isRoomChunk(Math.floor(worldY / CHUNK_SIZE)) ? "flat" : "floating";
}
