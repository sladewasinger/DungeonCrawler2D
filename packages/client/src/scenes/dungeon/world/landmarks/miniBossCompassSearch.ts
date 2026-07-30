import {
  CHUNK_SIZE,
  MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS,
  miniBossArenaForChunk,
  miniBossArenaIsStamped,
  type World,
} from "@dc2d/engine";
import {
  landmarkDistance,
  nearestLandmark,
} from "./compassLandmarkMath.js";
import type { CompassLandmarkPosition } from "./compassLandmarkTypes.js";

const EMPTY_DEFEATED_ARENAS = new Set<string>();

export interface MiniBossCompassSearch {
  readonly world: World;
  readonly x: number;
  readonly y: number;
  readonly defeatedArenaChunks?: ReadonlySet<string>;
}

export function nearestMiniBossArena(
  request: MiniBossCompassSearch,
): CompassLandmarkPosition | null {
  const { world, x, y } = request;
  const defeatedArenaChunks =
    request.defeatedArenaChunks ?? EMPTY_DEFEATED_ARENAS;
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkY = Math.floor(y / CHUNK_SIZE);
  let nearest: CompassLandmarkPosition | null = null;
  for (let radius = 0; radius <= MINI_BOSS_ARENA_COMPASS_RADIUS_CHUNKS; radius++) {
    nearest = nearestArenaInRing({
      world,
      x,
      y,
      chunkX,
      chunkY,
      radius,
      nearest,
      defeatedArenaChunks,
    });
    if (searchContainsNearest({ x, y, chunkX, chunkY, radius, nearest })) return nearest;
  }
  return nearest;
}

interface ArenaSearchRing {
  readonly x: number;
  readonly y: number;
  readonly chunkX: number;
  readonly chunkY: number;
  readonly radius: number;
  readonly nearest: CompassLandmarkPosition | null;
}

interface ArenaRingRequest extends ArenaSearchRing {
  readonly world: World;
  readonly defeatedArenaChunks: ReadonlySet<string>;
}

function nearestArenaInRing(
  request: ArenaRingRequest,
): CompassLandmarkPosition | null {
  const { chunkX, chunkY, radius, world, x, y, nearest, defeatedArenaChunks } = request;
  const candidates = ringChunks(chunkX, chunkY, radius)
    .flatMap((chunk) => miniBossArenaCenter({
      world,
      chunk,
      defeatedArenaChunks,
    }));
  return nearestLandmark({ positions: nearest ? [nearest, ...candidates] : candidates, x, y });
}

function miniBossArenaCenter(request: {
  readonly world: World;
  readonly chunk: { readonly cx: number; readonly cy: number };
  readonly defeatedArenaChunks: ReadonlySet<string>;
}): CompassLandmarkPosition[] {
  const { world, chunk, defeatedArenaChunks } = request;
  const { cx, cy } = chunk;
  if (defeatedArenaChunks.has(arenaChunkKey(cx, cy))) return [];
  const arena = miniBossArenaForChunk({ worldSeed: world.worldSeed, floor: world.floor, cx, cy });
  if (!arena || !miniBossArenaIsStamped(world, arena)) return [];
  return [{ x: arena.center.x + 0.5, y: arena.center.y + 0.5 }];
}

export function arenaChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

function searchContainsNearest(input: ArenaSearchRing): boolean {
  const { nearest, x, y, chunkX, chunkY, radius } = input;
  return nearest !== null && outerSearchDistance({ x, y, chunkX, chunkY, radius }) >=
    landmarkDistance(x, y, nearest);
}

function outerSearchDistance(input: Pick<
  ArenaSearchRing,
  "x" | "y" | "chunkX" | "chunkY" | "radius"
>): number {
  const { x, y, chunkX, chunkY, radius } = input;
  const minX = (chunkX - radius) * CHUNK_SIZE;
  const maxX = (chunkX + radius + 1) * CHUNK_SIZE;
  const minY = (chunkY - radius) * CHUNK_SIZE;
  const maxY = (chunkY + radius + 1) * CHUNK_SIZE;
  return Math.min(x - minX, maxX - x, y - minY, maxY - y);
}

function ringChunks(
  cx: number,
  cy: number,
  radius: number,
): Array<{ readonly cx: number; readonly cy: number }> {
  if (radius === 0) return [{ cx, cy }];
  const chunks: Array<{ readonly cx: number; readonly cy: number }> = [];
  for (let offset = -radius; offset <= radius; offset++) {
    chunks.push({ cx: cx + offset, cy: cy - radius });
    chunks.push({ cx: cx + offset, cy: cy + radius });
  }
  for (let offset = -radius + 1; offset < radius; offset++) {
    chunks.push({ cx: cx - radius, cy: cy + offset });
    chunks.push({ cx: cx + radius, cy: cy + offset });
  }
  return chunks;
}
