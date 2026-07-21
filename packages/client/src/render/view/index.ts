// The seam (2.5D rotation lane, step 1): every terrain/entity draw decision that cares
// about camera rotation flows through these exports, never a hand-rolled rotation.
export {
  VIEW_ORIENTATIONS,
  normalizeOrientation,
  rotateOrientation,
  wrapDegrees,
  type ViewOrientation,
} from "./viewOrientation.js";
export { getViewOrientation, resetViewOrientation, setViewOrientation } from "./viewState.js";
export { viewTileToWorld, viewToWorld, worldTileToView, worldToView, type Point } from "./viewTransform.js";
export { pickTallestFirst, type TallestFirstPick } from "./picking.js";
export {
  screenNorthWorldDirection,
  screenSlotFor,
  screenSouthWorldDirection,
  stairTreadAxis,
  type CompassDir,
} from "./directionRemap.js";
export {
  compareViewDepth,
  depthForViewEntity,
  viewSpaceFeetY,
  type ViewDepthKey,
} from "./viewDepth.js";
export {
  advanceRotationTween,
  isPastCrossfadeMidpoint,
  isRotationTweenDone,
  ROTATION_TWEEN_MS,
  rotationTweenAngle,
  rotationTweenProgress,
  startRotationTween,
  type RotationTween,
} from "./rotationTween.js";
