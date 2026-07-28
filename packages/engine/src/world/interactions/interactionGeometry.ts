import {
  FEATURE_FACE,
  type FeatureFace,
} from "../core/types.js";

export interface InteractionPoint {
  readonly x: number;
  readonly y: number;
}

export function featureAnchor(
  tile: InteractionPoint,
  face: FeatureFace,
): InteractionPoint {
  switch (face) {
    case FEATURE_FACE.North: return { x: tile.x + 0.5, y: tile.y };
    case FEATURE_FACE.East: return { x: tile.x + 1, y: tile.y + 0.5 };
    case FEATURE_FACE.South: return { x: tile.x + 0.5, y: tile.y + 1 };
    case FEATURE_FACE.West: return { x: tile.x, y: tile.y + 0.5 };
    default: return { x: tile.x + 0.5, y: tile.y + 0.5 };
  }
}

export function isOnFeatureSide(
  position: InteractionPoint,
  anchor: InteractionPoint,
  face: FeatureFace,
): boolean {
  switch (face) {
    case FEATURE_FACE.North: return position.y <= anchor.y;
    case FEATURE_FACE.East: return position.x >= anchor.x;
    case FEATURE_FACE.South: return position.y >= anchor.y;
    case FEATURE_FACE.West: return position.x <= anchor.x;
    default: return true;
  }
}

export function featureApproachPosition(
  feature: InteractionPoint & { readonly featureFace: FeatureFace },
): InteractionPoint {
  const anchor = featureAnchor(feature, feature.featureFace);
  switch (feature.featureFace) {
    case FEATURE_FACE.North: return { x: anchor.x, y: anchor.y - 0.5 };
    case FEATURE_FACE.East: return { x: anchor.x + 0.5, y: anchor.y };
    case FEATURE_FACE.South: return { x: anchor.x, y: anchor.y + 0.5 };
    case FEATURE_FACE.West: return { x: anchor.x - 0.5, y: anchor.y };
    default: return anchor;
  }
}
