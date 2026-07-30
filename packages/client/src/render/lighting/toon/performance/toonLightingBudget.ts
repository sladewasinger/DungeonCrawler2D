import { PLAYER_GROUND_LIGHT_MAX_CELLS } from "../../ground/playerGroundLight.js";
import { TOON_LIGHTING_TUNING } from "../toonLightingTuning.js";

/**
 * Fixed render-object budget for toon LOS. Visible terrain is painted into one
 * Graphics capture, while the legacy floor-light pool is disabled.
 */
export const TOON_LIGHTING_BUDGET = {
  maskGameObjects: TOON_LIGHTING_TUNING.maximumMaskObjects,
  playerGroundLightObjects: 0,
  classicMaximumPlayerGroundLightObjects: PLAYER_GROUND_LIGHT_MAX_CELLS,
  lineOfSightChecksPerRebuild: TOON_LIGHTING_TUNING.maximumFieldCells,
  evaluatedCellsPerRebuild: TOON_LIGHTING_TUNING.maximumFieldCells,
} as const;
