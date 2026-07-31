import type { PlayerEntityView } from "../visuals/view.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";

/** Resolves the two-direction body sprite from canonical player facing. */
export function playerFacesLeft(view: PlayerEntityView): boolean {
  return Math.cos(bodyFacingAngle(view)) < 0;
}

function bodyFacingAngle(view: PlayerEntityView): number {
  if (view.attacking) return worldAngleToView(view.attackAngleRad, getViewOrientation());
  if (view.weaponAimAngle !== null) return view.weaponAimAngle;
  return canonicalFacingAngle(view);
}

function canonicalFacingAngle(view: PlayerEntityView): number {
  return worldAngleToView(Math.atan2(view.faceY, view.faceX), getViewOrientation());
}
