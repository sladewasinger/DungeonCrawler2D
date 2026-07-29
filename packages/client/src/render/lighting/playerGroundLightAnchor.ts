import { groundToScreen } from "../entities/geometry/worldToScreen.js";

/** The interpolated actor point shared by personal halo and darkness-mask reveal. */
export interface PlayerGroundLightAnchor {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
}

export interface PlayerGroundLightAnchorSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MutablePlayerGroundLightAnchor {
  x: number;
  y: number;
  groundHeight?: number;
}

/** Keeps personal lighting on the same authoritative pose as the player body. */
export function playerGroundLightAnchor(
  source: PlayerGroundLightAnchorSource,
): PlayerGroundLightAnchor {
  return {
    x: source.x,
    y: source.y,
    groundHeight: source.z,
  };
}

export function applyPlayerGroundLightAnchor(
  light: MutablePlayerGroundLightAnchor,
  anchor: PlayerGroundLightAnchor,
): void {
  light.x = anchor.x;
  light.y = anchor.y;
  light.groundHeight = anchor.groundHeight;
}

/** Applies current view orientation and the authoritative elevation exactly once. */
export function projectPlayerGroundLightAnchor(
  anchor: PlayerGroundLightAnchor,
): { x: number; y: number } {
  return groundToScreen(anchor.x, anchor.y, anchor.groundHeight);
}
