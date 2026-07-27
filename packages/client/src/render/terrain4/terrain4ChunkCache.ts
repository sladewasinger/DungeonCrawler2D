import { CHUNK_SIZE } from "@dc2d/engine";
import type { ViewOrientation } from "../view/viewOrientation.js";
import {
  planTerrain4,
  type Terrain4Batches,
  type Terrain4Plan,
  type Terrain4Rect,
  type Terrain4Source,
} from "./terrainPlanner.js";

export interface Terrain4ChunkCoord { readonly cx: number; readonly cy: number; }

/** Reuses immutable planner output per chunk/orientation/revision. */
export class Terrain4ChunkPlanCache {
  private readonly plans = new Map<string, Terrain4Plan>();
  private revision: number | null = null;

  get(source: Terrain4Source, coord: Terrain4ChunkCoord, orientation: ViewOrientation, revision: number): Terrain4Plan {
    if (this.revision !== revision) {
      this.plans.clear();
      this.revision = revision;
    }
    const key = cacheKey(coord, orientation, revision);
    const cached = this.plans.get(key);
    if (cached) return cached;
    const bounds = {
      x: coord.cx * CHUNK_SIZE,
      y: coord.cy * CHUNK_SIZE,
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
    } satisfies Terrain4Rect;
    const plan = planTerrain4(source, { bounds, orientation, seamApron: 1 });
    this.plans.set(key, plan);
    return plan;
  }

  invalidateTile(wx: number, wy: number): void {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cy = Math.floor(wy / CHUNK_SIZE);
    for (const key of [...this.plans.keys()]) {
      const [keyCx, keyCy] = key.split(":", 3).map(Number);
      if (keyCx === undefined || keyCy === undefined) continue;
      if (Math.abs(keyCx - cx) <= 1 && Math.abs(keyCy - cy) <= 1) this.plans.delete(key);
    }
  }

  clear(): void { this.plans.clear(); this.revision = null; }
  get size(): number { return this.plans.size; }
}

export function appendVisibleChunkPlans(
  target: { floors: Terrain4Plan["batches"]["floors"] extends readonly (infer T)[] ? T[] : never[]; voids: Terrain4Plan["batches"]["voids"] extends readonly (infer T)[] ? T[] : never[]; features: Terrain4Plan["batches"]["features"] extends readonly (infer T)[] ? T[] : never[]; props: Terrain4Plan["batches"]["props"] extends readonly (infer T)[] ? T[] : never[]; southFaces: Terrain4Plan["batches"]["southFaces"] extends readonly (infer T)[] ? T[] : never[]; cliffEdges: Terrain4Plan["batches"]["cliffEdges"] extends readonly (infer T)[] ? T[] : never[]; ao: Terrain4Plan["batches"]["ao"] extends readonly (infer T)[] ? T[] : never[] },
  cache: Terrain4ChunkPlanCache,
  source: Terrain4Source,
  bounds: Terrain4Rect,
  orientation: ViewOrientation,
  revision: number,
): void {
  const minCx = Math.floor(bounds.x / CHUNK_SIZE);
  const minCy = Math.floor(bounds.y / CHUNK_SIZE);
  const maxCx = Math.floor((bounds.x + bounds.width - 1) / CHUNK_SIZE);
  const maxCy = Math.floor((bounds.y + bounds.height - 1) / CHUNK_SIZE);
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const plan = cache.get(source, { cx, cy }, orientation, revision);
      target.floors.push(...plan.batches.floors);
      target.voids.push(...plan.batches.voids);
      target.features.push(...plan.batches.features);
      target.props.push(...plan.batches.props);
      target.southFaces.push(...plan.batches.southFaces);
      target.cliffEdges.push(...plan.batches.cliffEdges);
      target.ao.push(...plan.batches.ao);
    }
  }
}

export function emptyTerrain4Batches(): {
  floors: NonNullable<Terrain4Batches["floors"]>[number][];
  voids: NonNullable<Terrain4Batches["voids"]>[number][];
  features: NonNullable<Terrain4Batches["features"]>[number][];
  props: NonNullable<Terrain4Batches["props"]>[number][];
  southFaces: NonNullable<Terrain4Batches["southFaces"]>[number][];
  cliffEdges: NonNullable<Terrain4Batches["cliffEdges"]>[number][];
  ao: NonNullable<Terrain4Batches["ao"]>[number][];
} {
  return { floors: [], voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [] };
}

function cacheKey(coord: Terrain4ChunkCoord, orientation: ViewOrientation, revision: number): string {
  return `${coord.cx}:${coord.cy}:${orientation}:${revision}`;
}
