// Pure targeting math for a dynamic light rebake: which resident chunks a tile's
// light could possibly reach, so a placed/expired torch rebuilds only the handful of
// chunks whose own baked-light apron actually covers it — never the whole streamed set.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TilePos } from "../lighting/torchPlacement.js";
import { worldTileToView } from "../view/viewTransform.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { chunkKey, type ChunkCoord } from "./streaming.js";
import { LIGHT_APRON } from "./tileLight.js";

/**
 * Every VIEW-chunk coordinate whose own computeLightField() apron (see tileLight.ts)
 * extends far enough to read the REAL-world tile (tileX, tileY) — i.e. every chunk
 * build that would change if this tile's light changed. A tile deep inside one chunk
 * yields just that chunk; a tile near a chunk edge yields its neighbor(s) too.
 *
 * Resident chunks are keyed by VIEW-chunk coordinate (chunkVisual.ts), but a torch's
 * (tileX, tileY) is a real-world position — the tile-index mapping (worldTileToView,
 * distance-preserving up to the one-cell floor convention shared with the terrain grid)
 * converts the tile to view-space FIRST, then the identical floor-division apron search
 * there yields the correct view-chunk coordinates without a per-orientation formula.
 * At orientation 0 the mapping is the identity, so this is unchanged from before.
 */
export function chunksInLightApron(tileX: number, tileY: number, orientation: ViewOrientation = 0): ChunkCoord[] {
  const view = worldTileToView({ x: tileX, y: tileY }, orientation);
  const minCx = Math.floor((view.x - LIGHT_APRON) / CHUNK_SIZE);
  const maxCx = Math.floor((view.x + LIGHT_APRON) / CHUNK_SIZE);
  const minCy = Math.floor((view.y - LIGHT_APRON) / CHUNK_SIZE);
  const maxCy = Math.floor((view.y + LIGHT_APRON) / CHUNK_SIZE);
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
export function affectedChunkKeys(tiles: readonly TilePos[], orientation: ViewOrientation = 0): Set<string> {
  const keys = new Set<string>();
  for (const tile of tiles) {
    for (const coord of chunksInLightApron(tile.wx, tile.wy, orientation)) keys.add(chunkKey(coord));
  }
  return keys;
}
