import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { appendPlanTiles, type MutableTerrainBatches } from "./terrainPlannerBuild.js";

export * from "../geometry/terrainPlannerModel.js";
import type {
  TerrainPlan, TerrainPlanOptions, TerrainRect, TerrainSource,
} from "../geometry/terrainPlannerModel.js";

/**
 * Produces the height-map renderer's minimal geometry in view space.
 *
 * Void produces flat quads, including backdrop rows that fill the projection
 * gap above lower Floor. A vertical face is similarly strict: both cells must
 * be finite Floor surfaces, and only a positive drop toward view-south emits
 * a face. Mapping the south neighbor through view space makes the same rule
 * work for all four cardinal camera orientations.
 */
export function planTerrain(source: TerrainSource, options: TerrainPlanOptions): TerrainPlan {
  assertRect(options.bounds, "bounds");
  const seamApron = validatedApron(options.seamApron);
  const batches = emptyBatches();
  const { bounds, orientation } = options;
  appendPlanTiles({ source, bounds, orientation, batches });
  return { bounds, sampleBounds: expandRect(bounds, seamApron), orientation, batches };
}

export interface TerrainPlanningContext {
  readonly source: TerrainSource;
  readonly bounds: TerrainRect;
  readonly orientation: ViewOrientation;
  readonly batches: MutableTerrainBatches;
}

function expandRect(rect: TerrainRect, apron: number): TerrainRect {
  return {
    x: rect.x - apron,
    y: rect.y - apron,
    width: rect.width + apron * 2,
    height: rect.height + apron * 2,
  };
}

function emptyBatches(): MutableTerrainBatches {
  return { floors: [], voids: [], features: [], props: [], southFaces: [], cliffEdges: [], ao: [] };
}

function validatedApron(apron: number | undefined): number {
  const value = apron ?? 1;
  if (!Number.isInteger(value) || value < 0) throw new Error("seamApron must be a non-negative integer");
  return value;
}

function assertRect(rect: TerrainRect, name: string): void {
  if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y) ||
      !Number.isInteger(rect.width) || !Number.isInteger(rect.height) ||
      rect.width < 0 || rect.height < 0) {
    throw new Error(`${name} must have integer coordinates and non-negative dimensions`);
  }
}
