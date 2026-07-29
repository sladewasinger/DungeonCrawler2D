import { CHUNK_SIZE } from "../../core/types.js";
import { isNearDescent, isNearLandmark } from "../landmarks/guard.js";
import { DISTRICT_CHUNK_SPAN, DISTRICT_TILE_SPAN } from "../layout/district.js";
import { applyRoomHeight } from "../terrain/height.js";
import type { Rect, Room } from "../types.js";
import type { DistrictGenerationState } from "./districtState.js";

function localRect(
  rect: Rect,
  districtX: number,
  districtY: number,
): Rect {
  const offsetX = districtX * CHUNK_SIZE;
  const offsetY = districtY * CHUNK_SIZE;
  return {
    x0: rect.x0 - offsetX,
    y0: rect.y0 - offsetY,
    x1: rect.x1 - offsetX,
    y1: rect.y1 - offsetY,
  };
}

function guardedInChunk(
  state: DistrictGenerationState,
  room: Room,
  offset: { x: number; y: number },
): boolean {
  const context = {
    worldSeed: state.worldSeed,
    floor: state.floor,
    cx: state.origin.cx + offset.x,
    cy: state.origin.cy + offset.y,
    rect: localRect(room.rect, offset.x, offset.y),
  };
  return isNearLandmark(context) || isNearDescent(context);
}

function isHeightGuarded(
  state: DistrictGenerationState,
  room: Room,
): boolean {
  if (isFloorEntryRoom(state, room)) return true;
  for (let y = 0; y < DISTRICT_CHUNK_SPAN; y++) {
    for (let x = 0; x < DISTRICT_CHUNK_SPAN; x++) {
      if (guardedInChunk(state, room, { x, y })) return true;
    }
  }
  return false;
}

/** Floor one opens on stable, flat terrain before the nearby showcase pass. */
function isFloorEntryRoom(
  state: DistrictGenerationState,
  room: Room,
): boolean {
  if (state.floor !== 1) return false;
  const offsetX = -state.origin.cx * CHUNK_SIZE;
  const offsetY = -state.origin.cy * CHUNK_SIZE;
  const entryChunk = {
    x0: offsetX,
    y0: offsetY,
    x1: offsetX + CHUNK_SIZE - 1,
    y1: offsetY + CHUNK_SIZE - 1,
  };
  return room.rect.x0 <= entryChunk.x1 &&
    room.rect.x1 >= entryChunk.x0 &&
    room.rect.y0 <= entryChunk.y1 &&
    room.rect.y1 >= entryChunk.y0;
}

export function applyDistrictRoomHeights(
  state: DistrictGenerationState,
): void {
  for (const room of state.rooms) {
    if (isHeightGuarded(state, room)) continue;
    applyRoomHeight({
      seed: state.districtLayoutSeed,
      tiles: state.tiles,
      height: state.height,
      corridorCarved: state.corridorCarved,
      chunkSize: DISTRICT_TILE_SPAN,
      room,
      doorways: state.doorways,
      district: state.district,
    });
  }
}
