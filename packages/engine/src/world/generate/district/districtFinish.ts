import { sealInteriorPockets } from "../../core/pockets.js";
import { demoteOrphanedStairs, repairCliffs } from "../terrain/cliffs.js";
import { markBedrockStructures } from "../terrain/bedrock.js";
import { markVoidTiles } from "../terrain/height.js";
import {
  resolveShallowPlateaus,
  resolveThinWalls,
} from "../terrain/verticalExtent.js";
import { applyWallHeight } from "../terrain/wallHeight.js";
import { DISTRICT_TILE_SPAN } from "../layout/district.js";
import type { DistrictGenerationState } from "./districtState.js";

export function finishDistrictTerrain(state: DistrictGenerationState): void {
  const size = DISTRICT_TILE_SPAN;
  sealInteriorPockets(
    state.tiles,
    state.corridorCarved,
    state.zones,
  );
  resolveThinWalls(state.tiles, size);
  repairCliffs(state.tiles, state.height, size);
  resolveShallowPlateaus(state.tiles, state.height, size);
  if (state.worldFeatures.voidTerrain) {
    markVoidTiles(state.tiles, state.height, size);
  }
  applyWallHeight(state.tiles, state.height, size);
  demoteOrphanedStairs(state.tiles, state.height, size);
  if (!state.worldFeatures.voidTerrain) {
    markBedrockStructures(state.tiles, size);
  }
}
