import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import { groundLightMaximumCells } from "./groundLightBudget.js";
import { groundLightStrength } from "./groundLightCurve.js";
import { groundLightCells } from "./groundLightSearch.js";
import type {
  GroundLightCell,
  GroundLightSource,
  GroundLightWorld,
} from "./groundLightTypes.js";

const GROUND_LIGHT = LIGHTING_VISUAL_STYLE.ground;

export const PLAYER_GROUND_LIGHT_RADIUS = GROUND_LIGHT.radiusTiles;
export const PLAYER_GROUND_LIGHT_MAX_CELLS = groundLightMaximumCells(
  PLAYER_GROUND_LIGHT_RADIUS,
);
export const PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS =
  GROUND_LIGHT.updateIntervalMs;
export const PLAYER_GROUND_LIGHT_FADE_MS = GROUND_LIGHT.fadeMs;

export type PlayerGroundLightWorld = GroundLightWorld;
export type PlayerGroundLightCell = GroundLightCell;
export type { GroundLightSource };

export interface PlayerGroundLightUpdate {
  readonly tileX: number;
  readonly tileY: number;
  readonly orientation: ViewOrientation;
  readonly atMs: number;
}

export function playerGroundLightFadeAlpha(
  startAlpha: number,
  targetAlpha: number,
  elapsedMs: number,
): number {
  const progress = Math.max(
    0,
    Math.min(1, elapsedMs / PLAYER_GROUND_LIGHT_FADE_MS),
  );
  const eased = progress * progress * (3 - 2 * progress);
  return startAlpha + (targetAlpha - startAlpha) * eased;
}

export function playerGroundLightStrength(distance: number): number {
  return groundLightStrength(distance, PLAYER_GROUND_LIGHT_RADIUS);
}

export function playerGroundLightCells(
  world: PlayerGroundLightWorld,
  source: Omit<GroundLightSource, "radiusTiles"> & { readonly radiusTiles?: number },
): readonly PlayerGroundLightCell[] {
  return groundLightCells(world, {
    ...source,
    radiusTiles: source.radiusTiles ?? PLAYER_GROUND_LIGHT_RADIUS,
  });
}

export function shouldUpdatePlayerGroundLight(
  previous: PlayerGroundLightUpdate | null,
  next: PlayerGroundLightUpdate,
): boolean {
  if (previous === null) return true;
  if (previous.tileX !== next.tileX || previous.tileY !== next.tileY) return true;
  if (previous.orientation !== next.orientation) return true;
  return next.atMs - previous.atMs >= PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS;
}
