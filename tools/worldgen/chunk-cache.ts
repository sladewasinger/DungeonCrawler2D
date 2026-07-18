// Lazy chunk cache over a loaded generator, exposing the tile/height/zone
// read surface the renderer and the stair-direction lookup need. Mirrors
// packages/engine/src/world/world.ts's World class but stays local to this
// tool (dev tooling only — never imported by engine/client/server).

import { CHUNK_SIZE, TILE, ZONE, type Chunk } from "../../packages/engine/src/world/types.js";
import type { GenerateChunkFn } from "./generator.js";

export class ChunkCache {
  private readonly chunks = new Map<string, Chunk>();

  constructor(
    private readonly generate: GenerateChunkFn,
    private readonly worldSeed: number,
    private readonly floor: number,
  ) {}

  getChunk(cx: number, cy: number): Chunk {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generate(this.worldSeed, this.floor, cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  private lookup(wx: number, wy: number): { chunk: Chunk; index: number } {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    const lx = wx - cx * CHUNK_SIZE;
    const ly = wy - cy * CHUNK_SIZE;
    return { chunk: this.getChunk(cx, cy), index: ly * CHUNK_SIZE + lx };
  }

  /** StairView contract (see world/stairs.ts): tile + height lookup by world tile coord. */
  tileAt(wx: number, wy: number): number {
    const { chunk, index } = this.lookup(Math.floor(wx), Math.floor(wy));
    return chunk.tiles[index] ?? TILE.Wall;
  }

  heightAt(wx: number, wy: number): number {
    const { chunk, index } = this.lookup(Math.floor(wx), Math.floor(wy));
    return chunk.height[index] ?? 0;
  }

  zoneAt(wx: number, wy: number): number {
    const { chunk, index } = this.lookup(Math.floor(wx), Math.floor(wy));
    return chunk.zones[index] ?? ZONE.None;
  }
}
