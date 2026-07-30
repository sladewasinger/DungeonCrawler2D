import type {
  WorldPresentationVisibility,
} from "../../../visibility/worldPresentationVisibility.js";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import type { TerrainRect } from "../../planning/terrainPlanner.js";
import type {
  TerrainBatchSelectionMetrics,
} from "../../planning/visibility/visibleTerrainBatches.js";
import { terrainPresentationPlanKey } from "./rootPresentation.js";

const EMPTY_METRICS: TerrainBatchSelectionMetrics = {
  candidateQuads: 0,
  submittedQuads: 0,
};

export class TerrainPresentationState {
  visibility: WorldPresentationVisibility | null = null;
  private visibilityRevision: number | null = null;
  private metrics = EMPTY_METRICS;

  setVisibility(visibility: WorldPresentationVisibility | null): boolean {
    if (this.visibility === visibility &&
        this.visibilityRevision === visibility?.revision) return false;
    this.visibility = visibility;
    this.visibilityRevision = visibility?.revision ?? null;
    return true;
  }

  record(metrics: TerrainBatchSelectionMetrics): void {
    this.metrics = metrics;
  }

  get submittedQuadCount(): number {
    return this.metrics.submittedQuads;
  }

  get candidateQuadCount(): number {
    return this.metrics.candidateQuads;
  }

  planKey(input: {
    readonly orientation: ViewOrientation;
    readonly bounds: TerrainRect;
    readonly tileRevision: number;
  }): string {
    return terrainPresentationPlanKey({
      ...input,
      visibilityRevision: this.visibilityRevision,
    });
  }
}
