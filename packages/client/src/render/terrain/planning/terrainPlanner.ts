import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { appendPlanTiles, type MutableTerrainBatches } from "./terrainPlannerBuild.js";

export * from "../geometry/terrainPlannerModel.js";
import type {
  TerrainPlan, TerrainPlanOptions, TerrainPresentation, TerrainRect, TerrainSource,
} from "../geometry/terrainPlannerModel.js";
import { OUTSIDE_TERRAIN_PRESENTATION } from "../geometry/terrainPlannerModel.js";

/**
 * Produces the height-map renderer's minimal geometry in view space.
 *
 * With VOID terrain enabled, Void produces flat quads plus backdrop rows and
 * finite Floor emits a one-tile floating face toward screen-south VOID.
 * Disabled mode rejects explicit Void as a world-generation invariant failure.
 * Floor-to-Floor faces always require a positive drop.
 * Mapping the south neighbor through view space makes the same rules work for
 * all four cardinal camera orientations.
 */
export function planTerrain(source: TerrainSource, options: TerrainPlanOptions): TerrainPlan {
  assertRect(options.bounds, "bounds");
  const seamApron = validatedApron(options.seamApron);
  const batches = emptyBatches();
  const { bounds, orientation } = options;
  const presentation = source.presentationAt?.(bounds.x, bounds.y) ??
    OUTSIDE_TERRAIN_PRESENTATION;
  const voidTerrain = source.voidTerrain || presentation.mode === "inside";
  const sampleBounds = expandRect(bounds, seamApron);
  if (!voidTerrain) assertFiniteSample(source, expandRect(bounds, 1));
  appendPlanTiles({
    source, bounds, orientation, batches, voidTerrain, presentation,
  });
  return { bounds, sampleBounds, orientation, presentation, batches };
}

export interface TerrainPlanningContext {
  readonly source: TerrainSource;
  readonly bounds: TerrainRect;
  readonly orientation: ViewOrientation;
  readonly batches: MutableTerrainBatches;
  readonly voidTerrain: boolean;
  readonly presentation: TerrainPresentation;
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

function assertFiniteSample(source: TerrainSource, bounds: TerrainRect): void {
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      if (!hasUnexpectedFiniteVoid(source, x, y)) continue;
      throw new Error(`VOID terrain leaked into disabled world at (${x}, ${y})`);
    }
  }
}

function hasUnexpectedFiniteVoid(
  source: TerrainSource,
  x: number,
  y: number,
): boolean {
  return source.terrainAt(x, y) === "void" &&
    source.allowsVoidAt?.(x, y) !== true;
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
