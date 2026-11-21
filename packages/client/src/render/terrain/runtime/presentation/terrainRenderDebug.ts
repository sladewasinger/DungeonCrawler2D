import type { TerrainBatchSelectionMetrics } from "../../planning/visibility/visibleTerrainBatches.js";
import type { TerrainAtlasRenderDebugState } from "../../batch/atlasBatch.js";
import type { TerrainBatches } from "../../planning/terrainPlanner.js";
import { runtimeWorkTracingEnabled } from "../../../../performance/runtimeWorkMetrics.js";
export interface TerrainRootVisibilityDebug {
  readonly orientation: number;
  readonly active: boolean;
  readonly graphicsVisible: boolean;
  readonly atlasVisible: boolean;
}

export interface TerrainRenderDebugSnapshot {
  readonly orientation: number;
  readonly bounds: string;
  readonly tileRevision: number;
  readonly pendingChunkPlans: number;
  readonly plan: TerrainPlanDebugCounts;
  readonly selection: TerrainBatchSelectionMetrics;
  readonly atlas: TerrainAtlasRenderDebugState;
  readonly roots: readonly TerrainRootVisibilityDebug[];
}

interface TerrainPlanDebugCounts {
  readonly floors: number;
  readonly bedrockFloors: number;
  readonly voids: number;
  readonly southFaces: number;
  readonly cliffEdges: number;
}

declare global {
  interface Window {
    __dc2dTerrainRender?: TerrainRenderDebugSnapshot;
  }
}

export function recordTerrainRenderDebug(input: {
  readonly orientation: number;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly tileRevision: number;
  readonly pendingChunkPlans: number;
  readonly batches: TerrainBatches;
  readonly selection: TerrainBatchSelectionMetrics;
  readonly atlas: TerrainAtlasRenderDebugState;
}): void {
  if (!runtimeWorkTracingEnabled || typeof window === "undefined") return;
  window.__dc2dTerrainRender = {
    orientation: input.orientation,
    bounds: `${input.bounds.x},${input.bounds.y},${input.bounds.width},${input.bounds.height}`,
    tileRevision: input.tileRevision,
    pendingChunkPlans: input.pendingChunkPlans,
    plan: planCounts(input.batches),
    selection: { ...input.selection },
    atlas: {
      activeMeshKeys: [...input.atlas.activeMeshKeys],
      retainedMeshKeys: [...input.atlas.retainedMeshKeys],
      overlayLayerKeys: [...input.atlas.overlayLayerKeys],
      meshVertexCounts: { ...input.atlas.meshVertexCounts },
      materialSamples: input.atlas.materialSamples.map((sample) => ({
        ...sample,
        ...(sample.worldTile ? { worldTile: { ...sample.worldTile } } : {}),
        uv: { ...sample.uv },
      })),
    },
    roots: [],
  };
}

export function terrainRootVisibilityDebug(
  roots: Iterable<TerrainRootVisibilityInput>,
  activeOrientation: number,
): readonly TerrainRootVisibilityDebug[] {
  return [...roots].map((root) => ({
    orientation: root.orientation,
    active: root.orientation === activeOrientation,
    graphicsVisible: root.graphics.visible,
    atlasVisible: root.atlas.isVisible,
  }));
}

interface TerrainRootVisibilityInput {
  readonly orientation: number;
  readonly graphics: { readonly visible: boolean };
  readonly atlas: { readonly isVisible: boolean };
}

export function recordTerrainRootVisibility(
  roots: readonly TerrainRootVisibilityDebug[],
): void {
  if (!runtimeWorkTracingEnabled || typeof window === "undefined" || !window.__dc2dTerrainRender) return;
  window.__dc2dTerrainRender = { ...window.__dc2dTerrainRender, roots };
}

function planCounts(batches: TerrainBatches): TerrainPlanDebugCounts {
  return {
    floors: batches.floors.length,
    bedrockFloors: batches.floors.filter(({ surface }) => surface === "bedrock").length,
    voids: batches.voids.length,
    southFaces: batches.southFaces.length,
    cliffEdges: batches.cliffEdges.length,
  };
}
