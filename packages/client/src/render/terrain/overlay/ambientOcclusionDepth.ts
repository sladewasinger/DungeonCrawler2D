import { depthForCapOccluder, depthForOccluder } from "../../entities/presentation/depthSort.js";
import type { TerrainAOQuad } from "../geometry/terrainPlannerModel.js";

const AMBIENT_OCCLUSION_BIAS = 0.06;

export function ambientOcclusionDepth(quad: TerrainAOQuad): number {
  const surfaceDepth = quad.surface === "wall"
    ? depthForOccluder(quad.viewTile.y + 1)
    : depthForCapOccluder(quad.viewTile.y);
  return surfaceDepth + AMBIENT_OCCLUSION_BIAS;
}
