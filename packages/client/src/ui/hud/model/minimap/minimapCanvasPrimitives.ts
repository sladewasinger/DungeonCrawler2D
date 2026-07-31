import {
  minimapMarkerColor,
  projectMinimapPoint,
} from "./minimapProjection.js";
import type {
  MinimapEntityMarker,
  MinimapLandmarkMarker,
  MinimapSnapshot,
} from "./minimapTypes.js";

export const drawMinimapGrid = (
  context: CanvasRenderingContext2D,
  radius: number,
): void => {
  context.fillStyle = "rgba(9, 11, 20, .88)";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(174, 180, 197, .18)";
  context.lineWidth = 1;
  for (const fraction of [0.5, 1]) drawRing(context, radius * fraction);
  context.beginPath();
  context.moveTo(-radius, 0);
  context.lineTo(radius, 0);
  context.moveTo(0, -radius);
  context.lineTo(0, radius);
  context.stroke();
};

const drawRing = (context: CanvasRenderingContext2D, radius: number): void => {
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
};

interface EntityRenderRequest {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: MinimapSnapshot;
  readonly bearingDeg: number;
  readonly radius: number;
  readonly entity: MinimapEntityMarker;
}

export const drawMinimapEntity = ({
  context,
  snapshot,
  bearingDeg,
  radius,
  entity,
}: EntityRenderRequest): void => {
  const point = projectMinimapPoint({
    dx: entity.x - snapshot.centerX,
    dy: entity.y - snapshot.centerY,
    bearingDeg,
    rangeTiles: snapshot.rangeTiles,
    radiusPx: radius,
  });
  if (!point.inside && entity.kind !== "self") return;
  context.fillStyle = minimapMarkerColor(entity.kind);
  context.beginPath();
  context.arc(point.x, point.y, entity.kind === "self" ? 3.5 : 2.5, 0, Math.PI * 2);
  context.fill();
};

interface LandmarkRenderRequest {
  readonly context: CanvasRenderingContext2D;
  readonly snapshot: MinimapSnapshot;
  readonly bearingDeg: number;
  readonly radius: number;
  readonly landmark: MinimapLandmarkMarker;
}

export const drawMinimapLandmark = ({
  context,
  snapshot,
  bearingDeg,
  radius,
  landmark,
}: LandmarkRenderRequest): void => {
  const point = projectMinimapPoint({
    dx: landmark.x - snapshot.centerX,
    dy: landmark.y - snapshot.centerY,
    bearingDeg,
    rangeTiles: snapshot.rangeTiles,
    radiusPx: radius,
    edgePaddingPx: 4,
  });
  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = point.inside ? 1 : 0.9;
  context.fillStyle = landmarkColor(landmark.kind);
  if (landmark.kind === "stairs") context.rotate(Math.PI / 4);
  context.fillRect(-3, -3, 6, 6);
  context.restore();
};

const landmarkColor = (kind: MinimapLandmarkMarker["kind"]): string => {
  if (kind === "safeRoom") return "#4ea8ff";
  if (kind === "miniBossArena") return "#ef5350";
  return "#ffd54c";
};
