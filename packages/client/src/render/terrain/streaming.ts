// Pure chunk-set math for camera-margin streaming: which chunks a view rect wants
// loaded, and the load/unload diff against whatever's currently resident.
import { CHUNK_SIZE } from "@dc2d/engine";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

export interface ChunkCoord {
  readonly cx: number;
  readonly cy: number;
}

export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

export function chunkKey(c: ChunkCoord): string {
  return `${c.cx},${c.cy}`;
}

/** Chunk coords whose bounds intersect the view rect expanded by `marginChunks` on every side. */
export function desiredChunks(view: ViewRect, marginChunks: number): ChunkCoord[] {
  const minCx = Math.floor(view.x / CHUNK_PX) - marginChunks;
  const maxCx = Math.floor((view.x + view.width) / CHUNK_PX) + marginChunks;
  const minCy = Math.floor(view.y / CHUNK_PX) - marginChunks;
  const maxCy = Math.floor((view.y + view.height) / CHUNK_PX) + marginChunks;
  const coords: ChunkCoord[] = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) coords.push({ cx, cy });
  }
  return coords;
}

/** What to load (desired but not resident) and unload (resident but no longer desired). */
export function diffChunks(
  desired: readonly ChunkCoord[],
  loadedKeys: ReadonlySet<string>,
): { toLoad: ChunkCoord[]; toUnloadKeys: string[] } {
  const desiredKeys = new Set(desired.map(chunkKey));
  const toLoad = desired.filter((c) => !loadedKeys.has(chunkKey(c)));
  const toUnloadKeys = [...loadedKeys].filter((k) => !desiredKeys.has(k));
  return { toLoad, toUnloadKeys };
}
