import { atlasUvBounds, type TerrainAtlasUvBounds } from "../geometry/atlasGeometry.js";
import type { TerrainAtlasDraw } from "./atlasBatch.js";

export interface TerrainMaterialDebugSample {
  readonly role: TerrainAtlasDraw["role"];
  readonly frame: string;
  readonly worldTile?: { readonly x: number; readonly y: number };
  readonly uv: TerrainAtlasUvBounds;
}

export function materialDebugSamples(
  draws: readonly TerrainAtlasDraw[],
  imageSize: (atlas: TerrainAtlasDraw["atlas"]) => { readonly width: number; readonly height: number },
): readonly TerrainMaterialDebugSample[] {
  return draws
    .filter(({ role }) => role === "bedrock" || role === "south-face" || role === "void-wall-face")
    .slice(0, 12)
    .map((draw) => ({
      role: draw.role,
      frame: draw.frame,
      ...(draw.worldTile ? { worldTile: { ...draw.worldTile } } : {}),
      uv: atlasUvBounds(draw, imageSize(draw.atlas)),
    }));
}
