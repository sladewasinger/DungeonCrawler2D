import { groundToScreen } from "../../geometry/worldToScreen.js";

/** The authoritative world-space grounding point shared by a landed torch's visuals. */
export interface TorchGroundAnchor {
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
}

export interface TorchGroundAnchorSource {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Preserves the server's landed position instead of normalizing it to a tile center. */
export function torchGroundAnchor(source: TorchGroundAnchorSource): TorchGroundAnchor {
  return {
    x: source.x,
    y: source.y,
    groundHeight: source.z,
  };
}

/** Applies the view transform and terrain-height lift exactly once for a grounded torch. */
export function projectTorchGroundAnchor(anchor: TorchGroundAnchor): {
  x: number;
  y: number;
} {
  return groundToScreen(anchor.x, anchor.y, anchor.groundHeight);
}
