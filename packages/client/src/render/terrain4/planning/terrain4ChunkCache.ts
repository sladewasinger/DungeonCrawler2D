import { CHUNK_SIZE } from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
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

  get(input: Terrain4ChunkPlanInput): Terrain4Plan {
    this.syncRevision(input.revision);
    const key = cacheKey(input.coord, input.orientation, input.revision);
    const cached = this.plans.get(key);
    if (cached) return cached;
    const plan = planTerrain4(input.source, { bounds: chunkBounds(input.coord), orientation: input.orientation, seamApron: 1 });
    this.plans.set(key, plan);
    return plan;
  }

  private syncRevision(revision: number): void {
    if (this.revision === revision) return;
    this.plans.clear();
    this.revision = revision;
  }

  invalidateTile(wx: number, wy: number): void {
    const target = { cx: Math.floor(wx / CHUNK_SIZE), cy: Math.floor(wy / CHUNK_SIZE) };
    for (const key of [...this.plans.keys()]) {
      if (isNeighborChunk(key, target)) this.plans.delete(key);
    }
  }

  clear(): void { this.plans.clear(); this.revision = null; }
  get size(): number { return this.plans.size; }
}

function isNeighborChunk(key: string, target: Terrain4ChunkCoord): boolean {
  const [cx, cy] = key.split(":", 3).map(Number);
  return cx !== undefined && cy !== undefined && Math.abs(cx - target.cx) <= 1 && Math.abs(cy - target.cy) <= 1;
}

export interface Terrain4ChunkPlanInput { readonly source: Terrain4Source; readonly coord: Terrain4ChunkCoord; readonly orientation: ViewOrientation; readonly revision: number; }
type MutableTerrain4Batches = { [Key in keyof Terrain4Batches]-?: NonNullable<Terrain4Batches[Key]> extends readonly (infer Value)[] ? Value[] : never; };

function chunkBounds(coord: Terrain4ChunkCoord): Terrain4Rect {
  return { x: coord.cx * CHUNK_SIZE, y: coord.cy * CHUNK_SIZE, width: CHUNK_SIZE, height: CHUNK_SIZE };
}

export function appendVisibleChunkPlans(
  input: VisibleChunkPlanInput,
): void {
  const { bounds } = input;
  const minCx = Math.floor(bounds.x / CHUNK_SIZE); const minCy = Math.floor(bounds.y / CHUNK_SIZE);
  const maxCx = Math.floor((bounds.x + bounds.width - 1) / CHUNK_SIZE); const maxCy = Math.floor((bounds.y + bounds.height - 1) / CHUNK_SIZE);
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      appendPlan(input.target, input.cache.get({ source: input.source, coord: { cx, cy }, orientation: input.orientation, revision: input.revision }));
    }
  }
}

export interface VisibleChunkPlanInput { readonly target: MutableTerrain4Batches; readonly cache: Terrain4ChunkPlanCache; readonly source: Terrain4Source; readonly bounds: Terrain4Rect; readonly orientation: ViewOrientation; readonly revision: number; }

function appendPlan(target: MutableTerrain4Batches, plan: Terrain4Plan): void {
  target.floors.push(...plan.batches.floors);
  target.voids.push(...plan.batches.voids);
  target.features.push(...plan.batches.features);
  target.props.push(...plan.batches.props);
  target.southFaces.push(...plan.batches.southFaces);
  target.cliffEdges.push(...plan.batches.cliffEdges);
  target.ao.push(...plan.batches.ao);
}

export function emptyTerrain4Batches(): MutableTerrain4Batches {
  return { floors: [], voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [] };
}

function cacheKey(coord: Terrain4ChunkCoord, orientation: ViewOrientation, revision: number): string {
  return `${coord.cx}:${coord.cy}:${orientation}:${revision}`;
}
