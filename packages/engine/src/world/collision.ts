/** Deterministic infinite chunk cache and continuous sliding movement collision. */
import { clamp } from "../math/noise.js";
import { generateChunk } from "./chunkGenerator.js";
import {
  GroundKind,
  chunkKey,
  worldTileIndex,
  worldToChunkCoord,
  worldToLocalCoord,
  type ChunkProp,
  type WorldChunk,
} from "./types.js";

export interface TileLookup {
  readonly ground: GroundKind;
  readonly elevation: number;
  readonly stairs: boolean;
}

export class WorldChunkCache {
  private readonly chunks = new Map<string, WorldChunk>();

  constructor(readonly worldSeed: number) {}

  getChunk(cx: number, cy: number): WorldChunk {
    const key = chunkKey(cx, cy);
    const existing = this.chunks.get(key);
    if (existing) return existing;
    const generated = generateChunk(this.worldSeed, cx, cy);
    this.chunks.set(key, generated);
    return generated;
  }

  tileAt(wx: number, wy: number): TileLookup {
    const cx = worldToChunkCoord(wx);
    const cy = worldToChunkCoord(wy);
    const chunk = this.getChunk(cx, cy);
    const idx = worldTileIndex(worldToLocalCoord(wx, cx), worldToLocalCoord(wy, cy));
    return {
      ground: (chunk.ground[idx] ?? GroundKind.Grass) as GroundKind,
      elevation: chunk.elevation[idx] ?? 0,
      stairs: (chunk.stairs[idx] ?? 0) === 1,
    };
  }

  propsNear(wx: number, wy: number): readonly ChunkProp[] {
    const cx = worldToChunkCoord(Math.floor(wx));
    const cy = worldToChunkCoord(Math.floor(wy));
    const out: ChunkProp[] = [];
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) out.push(...this.getChunk(cx + ox, cy + oy).props);
    }
    return out;
  }

  size(): number {
    return this.chunks.size;
  }
}

export interface MovementQuery {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly radius: number;
  readonly elevation: number;
}

export interface MovementResult {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly speedMultiplier: number;
  readonly inWater: boolean;
}

interface StandCheck {
  readonly cache: WorldChunkCache;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly fromElevation: number;
  readonly onStairs: boolean;
}

function rowPassable(check: StandCheck, ty: number, bounds: { minTx: number; maxTx: number }): boolean {
  for (let tx = bounds.minTx; tx <= bounds.maxTx; tx++) {
    const tile = check.cache.tileAt(tx, ty);
    if (tile.ground === GroundKind.DeepWater) return false;
    const bridged = tile.stairs || check.onStairs;
    const allowed = bridged ? Math.abs(tile.elevation - check.fromElevation) <= 1 : tile.elevation === check.fromElevation;
    if (!allowed) return false;
  }
  return true;
}

function canStandAt(check: StandCheck): boolean {
  const footDepth = Math.min(check.radius, 0.14);
  const minTx = Math.floor(check.x - check.radius);
  const maxTx = Math.floor(check.x + check.radius);
  const minTy = Math.floor(check.y - footDepth);
  const maxTy = Math.floor(check.y + footDepth);
  for (let ty = minTy; ty <= maxTy; ty++) {
    if (!rowPassable(check, ty, { minTx, maxTx })) return false;
  }
  return true;
}

function pushOutOfProps(input: {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly props: readonly ChunkProp[];
}): { x: number; y: number } {
  let { x, y } = input;
  for (const prop of input.props) {
    if (!prop.blocksMovement || prop.radius <= 0) continue;
    const vx = x - prop.x;
    const vy = y - prop.y;
    const minDist = input.radius + prop.radius;
    const distSq = vx * vx + vy * vy;
    if (distSq >= minDist * minDist || distSq <= 1e-8) continue;
    const dist = Math.sqrt(distSq);
    const push = minDist - dist;
    x += (vx / dist) * push;
    y += (vy / dist) * push;
  }
  return { x, y };
}

export function resolveMovement(query: MovementQuery): MovementResult {
  const { cache, dx, dy, radius, elevation } = query;
  const onStairs = cache.tileAt(Math.floor(query.x), Math.floor(query.y)).stairs;
  let { x, y } = query;
  if (canStandAt({ cache, x: x + dx, y, radius, fromElevation: elevation, onStairs })) x += dx;
  if (canStandAt({ cache, x, y: y + dy, radius, fromElevation: elevation, onStairs })) y += dy;
  const pushed = pushOutOfProps({ x, y, radius, props: cache.propsNear(x, y) });
  if (canStandAt({ cache, x: pushed.x, y: pushed.y, radius, fromElevation: elevation, onStairs })) {
    x = pushed.x;
    y = pushed.y;
  }
  const destTile = cache.tileAt(Math.floor(x), Math.floor(y));
  const nextElevation = destTile.stairs ? elevation : clamp(destTile.elevation, 0, 2);
  const inWater = destTile.ground === GroundKind.ShallowWater;
  return { x, y, elevation: nextElevation, speedMultiplier: inWater ? 0.65 : 1, inWater };
}
