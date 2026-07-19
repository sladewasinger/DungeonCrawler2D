import { generateChunk } from "./generate.js";
import { WALL_FACE_MIN_DROP } from "../core/constants.js";
import { isRoomChunk } from "./features/rooms.js";
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
  type WallFace,
  type ZoneType,
} from "./types.js";

/** Span cap: a facade projects at most this many rows south of its source. */
const SPAN_CAP = 3;

/** The four door tiles punch through: never a facade source, never a facade host. */
function isDoorTile(tile: TileType): boolean {
  return (
    tile === TILE.DoorSafeRoom ||
    tile === TILE.DoorPersonal ||
    tile === TILE.DoorParty ||
    tile === TILE.DoorExit
  );
}

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
    return !SOLID_TILES.has(this.tileAt(wx, wy)) && this.wallFaceAt(wx, wy) === null;
  }

  /**
   * A visible south-facing drop projected onto this tile from a raised
   * source up to SPAN_CAP rows north (any tile type — a facade is a
   * HEIGHT phenomenon, not a Wall-only one: raised floor casts a facade
   * just like a wall does). Doors never source or host a facade — a
   * door tile always punches through, and never counts as the raised
   * surface behind one. Bounded scan: at most SPAN_CAP north lookups.
   *
   * Stretch rooms (features/rooms.ts) never produce facades: their
   * ROOM_WALL_RISE perimeter is a sealed, unclimbable boundary — a
   * different doctrine from the overworld's jumpable WALL_RISE — and it
   * rises far more than a facade's span is meant to project. Without this
   * exemption, any interior tile within SPAN_CAP rows of that wall (the
   * spawn point, the stash, the crafting table — all placed on the first
   * interior row by design) would read as blocked/ejectable, which is
   * wrong: they're plain sanctuary floor, not a cliff base.
   */
  wallFaceAt(wx: number, wy: number): WallFace | null {
    if (isRoomChunk(Math.floor(wy / CHUNK_SIZE))) return null;
    if (isDoorTile(this.tileAt(wx, wy))) return null;
    for (let offset = 1; offset <= SPAN_CAP; offset++) {
      const sourceY = wy - offset;
      if (isDoorTile(this.tileAt(wx, sourceY))) continue;
      const top = this.heightAt(wx, sourceY);
      const foot = this.heightAt(wx, sourceY + 1);
      if (top - foot < WALL_FACE_MIN_DROP) continue;
      const span = Math.min(Math.max(1, Math.round(top - foot)), SPAN_CAP);
      if (offset > span) continue;
      return { sourceX: wx, sourceY, bottom: this.heightAt(wx, wy), top, span };
    }
    return null;
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
