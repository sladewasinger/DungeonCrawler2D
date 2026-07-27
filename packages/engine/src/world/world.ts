import { CHASM_DEATH_Z } from "../core/constants.js";
import { generateChunk } from "./generate.js";
import { LEVEL, type LevelId } from "./level.js";
import { stairRampAt } from "./stairs.js";
import {
  CHUNK_SIZE,
  SOLID_TILES,
  TERRAIN,
  TILE,
  ZONE,
  type Chunk,
  type TerrainType,
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
  // Two-level Map (cx -> cy -> Chunk), not a `${cx},${cy}` string key: this lookup sits
  // behind every heightAt/tileAt/zoneAt call, and those get called ~16x more often per
  // tile since MAX_FACE_ROWS rose 3 -> 16 (ownFace.ts) for the explicit-heights reskin.
  // Native number keys skip the per-call template-string allocation + hash that a string
  // key would otherwise pay on every single terrain read.
  private readonly chunks = new Map<number, Map<number, Chunk>>();
  private tileOverrides = new Map<string, TileType>();
  tileRevision = 0;

  constructor(
    readonly worldSeed: number,
    readonly floor: number,
    readonly level: LevelId = LEVEL.Dungeon,
  ) {}

  getChunk(cx: number, cy: number): Chunk {
    let row = this.chunks.get(cx);
    if (!row) {
      row = new Map<number, Chunk>();
      this.chunks.set(cx, row);
    }
    let chunk = row.get(cy);
    if (!chunk) {
      chunk = generateChunk(this.worldSeed, this.floor, cx, cy, this.level);
      row.set(cy, chunk);
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
    const overridden = this.tileOverrides.get(`${wx},${wy}`);
    if (overridden !== undefined) return overridden;
    const { chunk, index } = this.lookup(wx, wy);
    if (chunk.terrain[index] === TERRAIN.Void) return TILE.Void;
    return (chunk.features[index] ?? chunk.tiles[index] ?? TILE.Floor) as TileType;
  }

  terrainAt(wx: number, wy: number): TerrainType {
    const overridden = this.tileOverrides.get(`${wx},${wy}`);
    if (overridden !== undefined) return overridden === TILE.Void ? TERRAIN.Void : TERRAIN.Floor;
    const { chunk, index } = this.lookup(wx, wy);
    return (chunk.terrain[index] ?? TERRAIN.Floor) as TerrainType;
  }

  replaceTileOverrides(
    overrides: readonly { x: number; y: number; tile: TileType }[],
  ): void {
    const next = new Map(overrides.map((entry) => [
      `${entry.x},${entry.y}`,
      entry.tile,
    ]));
    if (next.size === this.tileOverrides.size) {
      let equal = true;
      for (const [key, tile] of next) {
        if (this.tileOverrides.get(key) !== tile) {
          equal = false;
          break;
        }
      }
      if (equal) return;
    }
    this.tileOverrides = next;
    this.tileRevision++;
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
    // A generated void/chasm is an infinite-height collision boundary, not a
    // low floor. Keeping this check here makes movement, jumping, landing,
    // and navigation agree without special cases in each caller.
    return this.terrainAt(wx, wy) !== TERRAIN.Void &&
      !SOLID_TILES.has(this.tileAt(wx, wy)) &&
      this.heightAt(wx, wy) > CHASM_DEATH_Z;
  }

  /** Continuous ground height: stair tiles ramp with position. */
  groundAt(x: number, y: number): number {
    return stairRampAt(this, x, y) ?? this.heightAt(Math.floor(x), Math.floor(y));
  }

  /** Ramp height iff (x, y) sits on a TILE.Stairs tile, else null — see WorldView's doc comment. */
  stairHeightAt(x: number, y: number): number | null {
    if (this.tileAt(Math.floor(x), Math.floor(y)) !== TILE.Stairs) return null;
    return stairRampAt(this, x, y);
  }

  isSanctuary(wx: number, wy: number): boolean {
    return this.zoneAt(wx, wy) === ZONE.Sanctuary;
  }

  /** Number of generated chunks currently cached (diagnostics). */
  get cachedChunkCount(): number {
    let total = 0;
    for (const row of this.chunks.values()) total += row.size;
    return total;
  }
}
