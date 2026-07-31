import { groundToScreen } from "../entities/geometry/worldToScreen.js";
import type { AdminDebugPoint } from "./adminDebugGeometry.js";

/** Projects authoritative 3D debug geometry through Phaser's elevation seam. */
export function gameplayDebugScreenPoint(
  point: AdminDebugPoint,
): { readonly x: number; readonly y: number } {
  return groundToScreen(point.x, point.y, point.z);
}
