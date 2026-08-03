import { CHUNK_SIZE } from "@dc2d/engine";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import {
  planTerrain,
  OUTSIDE_TERRAIN_PRESENTATION,
  type TerrainPlan,
  type TerrainRect,
  type TerrainSource,
} from "./terrainPlanner.js";
import { TERRAIN_RUNTIME_TUNING } from "../terrainRuntimeTuning.js";
import type { WorldPresentationVisibility } from "../../visibility/worldPresentationVisibility.js";
import {
  addMetrics,
  appendVisibleTerrainPlan,
  emptySelectionMetrics,
  type TerrainBatchSelectionMetrics,
  type MutableTerrainBatches,
} from "./visibility/visibleTerrainBatches.js";
import {
  chunkBounds,
  chunkIntersectsFiniteBounds,
  emptyPlanForChunk,
} from "./finiteChunkAdmission.js";

export { emptyTerrainBatches } from "./visibility/visibleTerrainBatches.js";

export interface TerrainChunkCoord { readonly cx: number; readonly cy: number; }

/** Reuses immutable planner output per chunk/orientation/revision. */
export class TerrainChunkPlanCache {
  private readonly plans = new Map<string, TerrainPlan>();
  private revision: number | null = null;

  constructor(
    private readonly capacity = TERRAIN_RUNTIME_TUNING.retention.maxChunkPlans,
  ) {
    if (capacity < 1) throw new Error("Terrain chunk-plan capacity must be positive");
  }

  get(input: TerrainChunkPlanInput): TerrainPlan {
    this.syncRevision(input.revision);
    if (!chunkIntersectsFiniteBounds(input.coord, input.source.finiteBounds)) {
      return emptyPlanForChunk(input);
    }
    const key = cacheKey(input);
    const cached = this.plans.get(key);
    if (cached) {
      this.touch(key, cached);
      return cached;
    }
    const plan = planTerrain(input.source, { bounds: chunkBounds(input.coord), orientation: input.orientation, seamApron: 1 });
    this.plans.set(key, plan);
    this.evictOverflow();
    return plan;
  }

  has(input: TerrainChunkPlanInput): boolean {
    this.syncRevision(input.revision);
    if (!chunkIntersectsFiniteBounds(input.coord, input.source.finiteBounds)) return false;
    return this.plans.has(cacheKey(input));
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

  private touch(key: string, plan: TerrainPlan): void {
    this.plans.delete(key);
    this.plans.set(key, plan);
  }

  private evictOverflow(): void {
    while (this.plans.size > this.capacity) {
      const oldest = this.plans.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.plans.delete(oldest);
    }
  }
}

function isNeighborChunk(key: string, target: TerrainChunkCoord): boolean {
  const [cx, cy] = key.split(":", 3).map(Number);
  return cx !== undefined && cy !== undefined && Math.abs(cx - target.cx) <= 1 && Math.abs(cy - target.cy) <= 1;
}

export interface TerrainChunkPlanInput { readonly source: TerrainSource; readonly coord: TerrainChunkCoord; readonly orientation: ViewOrientation; readonly revision: number; }

export function appendVisibleChunkPlans(input: VisibleChunkPlanInput): TerrainBatchSelectionMetrics {
  const metrics = emptySelectionMetrics();
  const { bounds } = input;
  if (bounds.width === 0 || bounds.height === 0) return metrics;
  let newPlanBudget = input.maxNewPlans ?? Number.POSITIVE_INFINITY;
  for (const coord of visibleChunkCoordinates(bounds, input.source.finiteBounds)) {
    const result = appendVisibleChunkPlan({ input, coord, newPlanBudget });
    newPlanBudget = result.remainingBudget;
    if (result.metrics) addMetrics(metrics, result.metrics);
  }
  return metrics;
}

function appendVisibleChunkPlan(input: { readonly input: VisibleChunkPlanInput; readonly coord: TerrainChunkCoord; readonly newPlanBudget: number }): { readonly remainingBudget: number; readonly metrics?: TerrainBatchSelectionMetrics } {
  const { input: request, coord } = input;
  const planInput = {
    source: request.source,
    coord,
    orientation: request.orientation,
    revision: request.revision,
  };
  const cached = request.cache.has(planInput);
  if (!cached && input.newPlanBudget <= 0) {
    request.onPendingPlan?.(coord);
    return { remainingBudget: input.newPlanBudget };
  }
  return { remainingBudget: input.newPlanBudget - Number(!cached), metrics: appendVisibleTerrainPlan({
    target: request.target, plan: request.cache.get(planInput), bounds: request.bounds, visibility: request.visibility,
  }) };
}

function visibleChunkCoordinates(
  bounds: TerrainRect,
  finiteBounds: TerrainRect | undefined,
): TerrainChunkCoord[] {
  const minCx = Math.floor(bounds.x / CHUNK_SIZE); const minCy = Math.floor(bounds.y / CHUNK_SIZE);
  const maxCx = Math.floor((bounds.x + bounds.width - 1) / CHUNK_SIZE); const maxCy = Math.floor((bounds.y + bounds.height - 1) / CHUNK_SIZE);
  const coords: TerrainChunkCoord[] = [];
  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const coord = { cx, cy };
      if (chunkIntersectsFiniteBounds(coord, finiteBounds)) coords.push(coord);
    }
  }
  return coords;
}

export interface VisibleChunkPlanInput { readonly target: MutableTerrainBatches; readonly cache: TerrainChunkPlanCache; readonly source: TerrainSource; readonly bounds: TerrainRect; readonly orientation: ViewOrientation; readonly revision: number; readonly visibility?: WorldPresentationVisibility | null; readonly maxNewPlans?: number | undefined; readonly onPendingPlan?: (coord: TerrainChunkCoord) => void; }

function cacheKey(input: TerrainChunkPlanInput): string {
  const { coord, orientation, revision, source } = input;
  const presentation = source.presentationAt?.(coord.cx * CHUNK_SIZE, coord.cy * CHUNK_SIZE) ?? OUTSIDE_TERRAIN_PRESENTATION;
  return [
    coord.cx, coord.cy, orientation, revision, Number(source.voidTerrain),
    presentation.mode, presentation.wallRise, source.cacheIdentity ?? "legacy",
    finiteBoundsKey(source.finiteBounds),
  ].join(":");
}

function finiteBoundsKey(bounds: TerrainRect | undefined): string {
  if (!bounds) return "unbounded";
  return `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
}
