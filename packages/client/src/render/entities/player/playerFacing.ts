import type { PlayerEntityView } from "../visuals/view.js";
import { getViewOrientation } from "../../view/transform/viewState.js";
import { worldAngleToView } from "../../view/transform/viewTransform.js";

/** Resolves the two-direction body sprite independently from weapon geometry. */
export function playerFacesLeft(
  weaponAngle: number,
  view: PlayerEntityView,
): boolean {
  if (view.assistedAim) return assistedPlayerFacesLeft(weaponAngle, view);
  if (view.weaponId === null || view.weaponAimAngle === null) {
    return view.faceX < 0;
  }
  return Math.cos(weaponAngle) < 0;
}

function assistedPlayerFacesLeft(
  weaponAngle: number,
  view: PlayerEntityView,
): boolean {
  if (!view.attacking) return Math.cos(weaponAngle) < 0;
  const angle = worldAngleToView(view.attackAngleRad, getViewOrientation());
  return Math.cos(angle) < 0;
}
