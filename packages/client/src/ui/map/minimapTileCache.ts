/** Chunk-level 32x32 1px/tile terrain bitmap cache for zero-reloop minimap panning. */
import { CHUNK_SIZE, GroundKind, type WorldChunkCache } from "@dc2d/engine";

const MAX_CACHED_MINIMAP_CHUNKS = 96;
const DEFAULT_RGB: readonly [number, number, number] = [63, 125, 58];
const GROUND_RGB: Readonly<Record<number, readonly [number, number, number]>> = {
  [GroundKind.DeepWater]: [29, 78, 216],
  [GroundKind.ShallowWater]: [59, 130, 246],
  [GroundKind.Sand]: [212, 163, 89],
  [GroundKind.Grass]: [63, 125, 58],
  [GroundKind.MeadowGrass]: [83, 154, 72],
  [GroundKind.ForestFloor]: [45, 90, 43],
  [GroundKind.DirtPath]: [140, 91, 54],
  [GroundKind.CliffStone]: [100, 116, 139],
  [GroundKind.MossStone]: [71, 105, 79],
  [GroundKind.AutumnGrass]: [140, 148, 62],
  [GroundKind.AutumnFloor]: [140, 74, 39],
  [GroundKind.BogMud]: [71, 59, 50],
  [GroundKind.BogMoss]: [55, 104, 80],
  [GroundKind.SlateRock]: [87, 96, 107],
  [GroundKind.AshGround]: [112, 107, 104],
  [GroundKind.RuinFlagstone]: [71, 70, 87],
  [GroundKind.CursedMoss]: [58, 46, 84],
};

function renderChunkBitmap(cache: WorldChunkCache, cx: number, cy: number): HTMLCanvasElement {
  const chunk = cache.getChunk(cx, cy);
  const canvas = document.createElement("canvas");
  canvas.width = CHUNK_SIZE;
  canvas.height = CHUNK_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.createImageData(CHUNK_SIZE, CHUNK_SIZE);
  const data = img.data;
  const total = CHUNK_SIZE * CHUNK_SIZE;
  for (let i = 0; i < total; i++) {
    const ground = chunk.ground[i] ?? GroundKind.Grass;
    const elev = chunk.elevation[i] ?? 0;
    const rgb = GROUND_RGB[ground] ?? DEFAULT_RGB;
    const lift = elev > 0 ? Math.min(48, elev * 22) : 0;
    const off = i * 4;
    data[off] = Math.min(255, rgb[0] + lift);
    data[off + 1] = Math.min(255, rgb[1] + lift);
    data[off + 2] = Math.min(255, rgb[2] + lift);
    data[off + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export class MinimapTileCache {
  private readonly chunks = new Map<string, HTMLCanvasElement>();

  acquireChunk(cache: WorldChunkCache, cx: number, cy: number): HTMLCanvasElement {
    const rev = cache.chunkRevision(cx, cy);
    const key = `${cache.worldSeed}:${cx}:${cy}:${rev}`;
    const existing = this.chunks.get(key);
    if (existing) {
      this.chunks.delete(key);
      this.chunks.set(key, existing);
      return existing;
    }
    const built = renderChunkBitmap(cache, cx, cy);
    this.chunks.set(key, built);
    while (this.chunks.size > MAX_CACHED_MINIMAP_CHUNKS) {
      const oldest = this.chunks.keys().next().value;
      if (oldest === undefined) break;
      this.chunks.delete(oldest);
    }
    return built;
  }

  paintViewport(opts: {
    readonly ctx: CanvasRenderingContext2D; readonly cache: WorldChunkCache;
    readonly tx0: number; readonly ty0: number; readonly zoom: number; readonly mapPx: number;
  }): void {
    const { ctx, cache, tx0, ty0, zoom, mapPx } = opts;
    const half = Math.floor(mapPx / (2 * zoom));
    const minCx = Math.floor((tx0 - half) / CHUNK_SIZE);
    const maxCx = Math.floor((tx0 + half - 1) / CHUNK_SIZE);
    const minCy = Math.floor((ty0 - half) / CHUNK_SIZE);
    const maxCy = Math.floor((ty0 + half - 1) / CHUNK_SIZE);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, mapPx, mapPx);
    const chunkPx = CHUNK_SIZE * zoom;
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const dx = (cx * CHUNK_SIZE - tx0 + half) * zoom;
        const dy = (cy * CHUNK_SIZE - ty0 + half) * zoom;
        ctx.drawImage(this.acquireChunk(cache, cx, cy), dx, dy, chunkPx, chunkPx);
      }
    }
  }
}
