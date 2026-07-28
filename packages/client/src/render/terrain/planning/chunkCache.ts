import { CHUNK_SIZE } from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  planTerrain,
  type TerrainBatches,
  type TerrainPlan,
  type TerrainRect,
  type TerrainSource,
} from "./terrainPlanner.js";

export interface TerrainChunkCoord { readonly cx: number; readonly cy: number; }

/** Reuses immutable planner output per chunk/orientation/revision. */
export class TerrainChunkPlanCache {
  private readonly plans = new Map<string, TerrainPlan>();
  private revision: number | null = null;

  get(input: TerrainChunkPlanInput): TerrainPlan {
    this.syncRevision(input.revision);
    const key = cacheKey(input.coord, input.orientation, input.revision);
    const cached = this.plans.get(key);
    if (cached) return cached;
    const plan = planTerrain(input.source, { bounds: chunkBounds(input.coord), orientation: input.orientation, seamApron: 1 });
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

function isNeighborChunk(key: string, target: TerrainChunkCoord): boolean {
  const [cx, cy] = key.split(":", 3).map(Number);
  return cx !== undefined && cy !== undefined && Math.abs(cx - target.cx) <= 1 && Math.abs(cy - target.cy) <= 1;
}

export interface TerrainChunkPlanInput { readonly source: TerrainSource; readonly coord: TerrainChunkCoord; readonly orientation: ViewOrientation; readonly revision: number; }
type MutableTerrainBatches = { [Key in keyof TerrainBatches]-?: NonNullable<TerrainBatches[Key]> extends readonly (infer Value)[] ? Value[] : never; };

function chunkBounds(coord: TerrainChunkCoord): TerrainRect {
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

export interface VisibleChunkPlanInput { readonly target: MutableTerrainBatches; readonly cache: TerrainChunkPlanCache; readonly source: TerrainSource; readonly bounds: TerrainRect; readonly orientation: ViewOrientation; readonly revision: number; }

function appendPlan(target: MutableTerrainBatches, plan: TerrainPlan): void {
  target.floors.push(...plan.batches.floors);
  target.voids.push(...plan.batches.voids);
  target.features.push(...plan.batches.features);
  target.props.push(...plan.batches.props);
  target.southFaces.push(...plan.batches.southFaces);
  target.cliffEdges.push(...plan.batches.cliffEdges);
  target.ao.push(...plan.batches.ao);
}

export function emptyTerrainBatches(): MutableTerrainBatches {
  return { floors: [], voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [] };
}

function cacheKey(coord: TerrainChunkCoord, orientation: ViewOrientation, revision: number): string {
  return `${coord.cx}:${coord.cy}:${orientation}:${revision}`;
}
