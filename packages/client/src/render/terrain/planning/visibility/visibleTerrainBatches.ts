import type {
  WorldPresentationVisibility,
} from "../../../visibility/worldPresentationVisibility.js";
import type {
  TerrainBatches,
  TerrainPlan,
  TerrainRect,
} from "../terrainPlanner.js";

export type MutableTerrainBatches = {
  [Key in keyof TerrainBatches]-?:
  NonNullable<TerrainBatches[Key]> extends readonly (infer Value)[]
    ? Value[]
    : never;
};

export interface TerrainBatchSelectionMetrics {
  candidateQuads: number;
  submittedQuads: number;
}

export function appendVisibleTerrainPlan(input: {
  readonly target: MutableTerrainBatches;
  readonly plan: TerrainPlan;
  readonly bounds: TerrainRect;
  readonly visibility: WorldPresentationVisibility | null | undefined;
}): TerrainBatchSelectionMetrics {
  const { target, plan, bounds, visibility } = input;
  const metrics = emptySelectionMetrics();
  addMetrics(metrics, appendVisible(target.floors, plan.batches.floors, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.voids, plan.batches.voids, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.features, plan.batches.features, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.props, plan.batches.props, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.southFaces, plan.batches.southFaces, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.cliffEdges, plan.batches.cliffEdges, { bounds, visibility }));
  addMetrics(metrics, appendVisible(target.ao, plan.batches.ao, { bounds, visibility }));
  return metrics;
}

function appendVisible<T extends {
  readonly worldTile: { readonly x: number; readonly y: number };
}>(
  target: T[],
  source: readonly T[],
  view: {
    readonly bounds: TerrainRect;
    readonly visibility: WorldPresentationVisibility | null | undefined;
  },
): TerrainBatchSelectionMetrics {
  const metrics = emptySelectionMetrics();
  for (const quad of source) {
    if (!containsWorldTile(view.bounds, quad.worldTile)) continue;
    metrics.candidateQuads += 1;
    if (!worldTileIsVisible(view.visibility, quad.worldTile)) continue;
    metrics.submittedQuads += 1;
    target.push(quad);
  }
  return metrics;
}

function worldTileIsVisible(
  visibility: WorldPresentationVisibility | null | undefined,
  tile: Readonly<{ x: number; y: number }>,
): boolean {
  return !visibility ||
    visibility.isWorldPositionVisible(tile.x + 0.5, tile.y + 0.5);
}

function containsWorldTile(
  bounds: TerrainRect,
  tile: Readonly<{ x: number; y: number }>,
): boolean {
  return tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height;
}

export function emptyTerrainBatches(): MutableTerrainBatches {
  return {
    floors: [],
    voids: [],
    features: [],
    props: [],
    southFaces: [],
    cliffEdges: [],
    ao: [],
  };
}

export function emptySelectionMetrics(): TerrainBatchSelectionMetrics {
  return { candidateQuads: 0, submittedQuads: 0 };
}

export function addMetrics(
  target: TerrainBatchSelectionMetrics,
  addition: TerrainBatchSelectionMetrics,
): void {
  target.candidateQuads += addition.candidateQuads;
  target.submittedQuads += addition.submittedQuads;
}
