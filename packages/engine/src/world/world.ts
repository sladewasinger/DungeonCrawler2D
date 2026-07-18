import { generateChunk } from "./generate.js";
import { LEVEL, type LevelId } from "./level.js";
import { stairRampAt } from "./stairs.js";
import {
  CHUNK_SIZE,
  SOLID_TILES,
  TILE,
  ZONE,
  type Chunk,
  type TileType,
  type WorldView,
  type ZoneType,
} from "./types.js";

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
    readonly level: LevelId = LEVEL.Dungeon,
  ) {}

  getChunk(cx: number, cy: number): Chunk {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = generateChunk(this.worldSeed, this.floor, cx, cy, this.level);
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
    return (chunk.tiles[index] ?? TILE.Wall) as TileType;
  }

  heightAt(wx: number, wy: number): number {
    const { chunk, index } = this.lookup(wx, wy);
    return chunk.height[index] ?? 0;
  }

  zoneAt(wx: number, wy: number): ZoneType {
    const { chunk, index } = this.lookup(wx, wy);
    return (chunk.zones[index] ?? ZONE.None) as ZoneType;
  }

  isWalkable(wx: number, wy: number): boolean {
    return !SOLID_TILES.has(this.tileAt(wx, wy));
  }

  /** Continuous ground height: stair tiles ramp with position. */
  groundAt(x: number, y: number): number {
    return stairRampAt(this, x, y) ?? this.heightAt(Math.floor(x), Math.floor(y));
  }

  isSanctuary(wx: number, wy: number): boolean {
    return this.zoneAt(wx, wy) === ZONE.Sanctuary;
  }

  /** Number of generated chunks currently cached (diagnostics). */
  get cachedChunkCount(): number {
    return this.chunks.size;
  }
}
