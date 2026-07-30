import {
  CHUNK_SIZE,
  isSafeRoomChunk,
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
  TILE,
  type World,
} from "@dc2d/engine";
import type { CompassLandmarkRequest } from "./compassLandmarks.js";
import type { CompassLandmarkPosition } from "./compassLandmarkSearch.js";

const SAFE_ROOM_SEARCH_RADIUS_CHUNKS = 2;
const EMPTY_DEFEATED_ARENAS = new Set<string>();

export interface CompassLandmarkCandidates {
  readonly safeRoom: readonly CompassLandmarkPosition[];
  readonly miniBossArena: readonly CompassLandmarkPosition[];
}

export function findCompassLandmarkCandidates(
  request: CompassLandmarkRequest,
): CompassLandmarkCandidates {
  const centerX = Math.floor(request.x / CHUNK_SIZE);
  const centerY = Math.floor(request.y / CHUNK_SIZE);
  const miniBossCenter = request.miniBossArenaWindowCenter ?? {
    cx: centerX,
    cy: centerY,
  };
  return {
    safeRoom: safeRoomCandidates(request.world, squareChunks(
      centerX,
      centerY,
      SAFE_ROOM_SEARCH_RADIUS_CHUNKS,
    )),
    miniBossArena: miniBossArenaCandidates(request, squareChunks(
      miniBossCenter.cx,
      miniBossCenter.cy,
      MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
    )),
  };
}

export function emptyCompassLandmarkCandidates(): CompassLandmarkCandidates {
  return { safeRoom: [], miniBossArena: [] };
}

function squareChunks(
  centerX: number,
  centerY: number,
  radius: number,
): Array<{ readonly cx: number; readonly cy: number }> {
  return Array.from({ length: 2 * radius + 1 }, (_, xOffset) =>
    Array.from({ length: 2 * radius + 1 }, (_, yOffset) => ({
      cx: centerX + xOffset - radius,
      cy: centerY + yOffset - radius,
    })),
  ).flat();
}

function safeRoomCandidates(
  world: World,
  chunks: readonly { readonly cx: number; readonly cy: number }[],
): CompassLandmarkPosition[] {
  return chunks.flatMap(({ cx, cy }) => {
    const chunk = { worldSeed: world.worldSeed, floor: world.floor, cx, cy };
    if (!isSafeRoomChunk(chunk)) return [];
    const doorIndex = world.getChunk(cx, cy).features.indexOf(TILE.DoorSafeRoom);
    return doorIndex < 0 ? [] : [{
      x: cx * CHUNK_SIZE + doorIndex % CHUNK_SIZE + 0.5,
      y: cy * CHUNK_SIZE + Math.floor(doorIndex / CHUNK_SIZE) + 0.5,
    }];
  });
}

function miniBossArenaCandidates(
  request: CompassLandmarkRequest,
  chunks: readonly { readonly cx: number; readonly cy: number }[],
): CompassLandmarkPosition[] {
  const defeatedArenaChunks =
    request.defeatedMiniBossArenaChunks ?? EMPTY_DEFEATED_ARENAS;
  return chunks.flatMap(({ cx, cy }) => {
    if (defeatedArenaChunks.has(`${cx},${cy}`)) return [];
    const arena = miniBossArenaForChunk({
      worldSeed: request.world.worldSeed,
      floor: request.world.floor,
      cx,
      cy,
    });
    return !arena || !miniBossArenaIsStamped(request.world, arena)
      ? []
      : [{ x: arena.center.x + 0.5, y: arena.center.y + 0.5 }];
  });
}
