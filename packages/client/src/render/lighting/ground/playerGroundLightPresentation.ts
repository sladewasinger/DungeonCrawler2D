import type { PlayerGroundLightCell } from "./playerGroundLight.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";

const MAX_PRESENTATION_CELLS = LIGHTING_VISUAL_STYLE.ground.maxPresentationCells;

export const PLAYER_GROUND_LIGHT_MAX_PRESENTATION_CELLS = MAX_PRESENTATION_CELLS;
export const PLAYER_GROUND_LIGHT_MAX_POOL_TILES = MAX_PRESENTATION_CELLS * 2;

export function presentationCells(
  cells: readonly PlayerGroundLightCell[],
): readonly PlayerGroundLightCell[] {
  if (cells.length <= MAX_PRESENTATION_CELLS) return cells;
  return [...cells]
    .sort((left, right) => right.strength - left.strength)
    .slice(0, MAX_PRESENTATION_CELLS);
}
