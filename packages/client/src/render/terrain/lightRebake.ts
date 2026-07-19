// Pure targeting math for a dynamic light rebake: which resident chunks a tile's
// light could possibly reach, so a placed/expired torch rebuilds only the handful of
// chunks whose own baked-light apron actually covers it — never the whole streamed set.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TilePos } from "../lighting/torchPlacement.js";
import { chunkKey, type ChunkCoord } from "./streaming.js";
import { LIGHT_APRON } from "./tileLight.js";

/**
 * Every chunk coordinate whose own computeLightField() apron (see tileLight.ts)
 * extends far enough to read (tileX, tileY) — i.e. every chunk build that would
 * change if this tile's light changed. A tile deep inside one chunk yields just
 * that chunk; a tile near a chunk edge yields its neighbor(s) too.
 */
export function chunksInLightApron(tileX: number, tileY: number): ChunkCoord[] {
  const minCx = Math.floor((tileX - LIGHT_APRON) / CHUNK_SIZE);
  const maxCx = Math.floor((tileX + LIGHT_APRON) / CHUNK_SIZE);
  const minCy = Math.floor((tileY - LIGHT_APRON) / CHUNK_SIZE);
  const maxCy = Math.floor((tileY + LIGHT_APRON) / CHUNK_SIZE);
  const coords: ChunkCoord[] = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) coords.push({ cx, cy });
  }
  return coords;
}

/**
 * Union of chunksInLightApron() over every changed tile, deduped by key — the
 * coalescing step: several torches landing/expiring in the same frame still rebuild
 * each affected chunk exactly once.
 */
export function affectedChunkKeys(tiles: readonly TilePos[]): Set<string> {
  const keys = new Set<string>();
  for (const tile of tiles) {
    for (const coord of chunksInLightApron(tile.wx, tile.wy)) keys.add(chunkKey(coord));
  }
  return keys;
}
