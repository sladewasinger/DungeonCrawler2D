import { depthForCapOccluder, depthForOccluder } from "../../entities/presentation/depthSort.js";
import type { TerrainAOQuad } from "../geometry/terrainPlannerModel.js";

export function ambientOcclusionDepth(quad: TerrainAOQuad): number {
  const surfaceDepth = quad.surface === "wall"
    ? depthForOccluder(quad.viewTile.y + 1)
    : depthForCapOccluder(quad.viewTile.y);
  return surfaceDepth;
}
