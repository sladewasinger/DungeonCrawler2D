// The seam (2.5D rotation lane, step 1): every terrain/entity draw decision that cares
// about camera rotation flows through these exports, never a hand-rolled rotation.
export {
  VIEW_ORIENTATIONS,
  normalizeOrientation,
  rotateOrientation,
  wrapDegrees,
  type ViewOrientation,
} from "./orientation/viewOrientation.js";
export { getViewOrientation, resetViewOrientation, setViewOrientation } from "./transform/viewState.js";
export { viewTileToWorld, viewToWorld, worldAngleToView, worldTileToView, worldToView, type Point } from "./transform/viewTransform.js";
export { pickTallestFirst, type TallestFirstPick } from "./picking/picking.js";
export {
  screenNorthWorldDirection,
  screenSlotFor,
  screenSouthWorldDirection,
  stairTreadAxis,
  type CompassDir,
} from "./orientation/directionRemap.js";
export {
  compareViewDepth,
  depthForViewEntity,
  viewSpaceFeetY,
  type ViewDepthKey,
} from "./transform/viewDepth.js";
export {
  advanceRotationTween,
  isPastCrossfadeMidpoint,
  isRotationTweenDone,
  ROTATION_TWEEN_MS,
  rotationTweenAngle,
  rotationTweenProgress,
  startRotationTween,
  type RotationTween,
} from "./orientation/rotationTween.js";
