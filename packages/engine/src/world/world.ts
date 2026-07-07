import { generateChunk } from "./generate";
import {
  CHUNK_SIZE,
  TILE,
  ZONE,
  type Chunk,
  type TileType,
  type WorldView,
  type ZoneType,
} from "./types";

/**
 * Lazy chunk cache over the deterministic generator. Both the game
 * server (authoritative) and the client (rendering + prediction)
 * construct one of these from the same (worldSeed, floor) and see
 * identical terrain.
 */
export class World implements WorldView {
  private readonly chunks = new Map<string, Chunk>();

  constructor(
    readonly worldSeed: number,
    readonly floor: number,
  ) {}

  getChunk(cx: number, cy: number): Chunk {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = generateChunk(this.worldSeed, this.floor, cx, cy);
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

  tileAt(wx: number, wy: number): TileType {
    const { chunk, index } = this.lookup(wx, wy);
    return chunk.tiles[index] as TileType;
  }

  heightAt(wx: number, wy: number): number {
    const { chunk, index } = this.lookup(wx, wy);
    return chunk.height[index] ?? 0;
  }

  zoneAt(wx: number, wy: number): ZoneType {
    const { chunk, index } = this.lookup(wx, wy);
    return chunk.zones[index] as ZoneType;
  }

  isWalkable(wx: number, wy: number): boolean {
    return this.tileAt(wx, wy) !== TILE.Wall;
  }

  isSanctuary(wx: number, wy: number): boolean {
    return this.zoneAt(wx, wy) === ZONE.Sanctuary;
  }

  /** Number of generated chunks currently cached (diagnostics). */
  get cachedChunkCount(): number {
    return this.chunks.size;
  }
}
