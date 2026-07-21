// View-space depth sorting key: entities/terrain still sort by "how far toward
// screen-south" (entities/depthSort.ts's existing feet/edge axis), but which world
// axis THAT is now depends on orientation. This module derives the effective
// feetWorldY to hand to depthForEntity/compareEntityDepth (entities/depthSort.ts,
// left untouched and orientation-agnostic) from a world position + orientation —
// callers feed its output in, they don't reimplement the row/lift math here.
import { depthForEntity, type DepthKey } from "../entities/depthSort.js";
import type { ViewOrientation } from "./viewOrientation.js";
import { worldToView } from "./viewTransform.js";

export interface ViewDepthKey extends DepthKey {
  readonly feetWorldX: number;
}

/** The view-space Y (screen-south-ward distance) for a world feet position at `orientation`. */
export function viewSpaceFeetY(feetWorldX: number, feetWorldY: number, orientation: ViewOrientation): number {
  return worldToView({ x: feetWorldX, y: feetWorldY }, orientation).y;
}

/** Phaser depth for a world position, accounting for the current view orientation. */
export function depthForViewEntity(key: ViewDepthKey, orientation: ViewOrientation): number {
  const viewY = viewSpaceFeetY(key.feetWorldX, key.feetWorldY, orientation);
  return depthForEntity(viewY, key.liftUnits ?? 0);
}

/** Sort comparator: view-space north-to-south, front-most (screen-south-most) last. */
export function compareViewDepth(orientation: ViewOrientation): (a: ViewDepthKey, b: ViewDepthKey) => number {
  return (a, b) => depthForViewEntity(a, orientation) - depthForViewEntity(b, orientation);
}
