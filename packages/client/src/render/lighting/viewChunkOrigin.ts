import { viewTileToWorld, type Point } from "../view/viewTransform.js";
import type { ViewOrientation } from "../view/viewOrientation.js";

export interface ViewChunkOriginRequest {
  readonly baseVX: number;
  readonly baseVY: number;
  readonly size: number;
  readonly orientation: ViewOrientation;
}

export function viewChunkWorldOrigin(request: ViewChunkOriginRequest): Point {
  const { baseVX, baseVY, size, orientation } = request;
  const far = size - 1;
  const corners = [
    { x: baseVX, y: baseVY },
    { x: baseVX + far, y: baseVY },
    { x: baseVX, y: baseVY + far },
    { x: baseVX + far, y: baseVY + far },
  ].map((corner) => viewTileToWorld(corner, orientation));
  return { x: Math.min(...corners.map((corner) => corner.x)), y: Math.min(...corners.map((corner) => corner.y)) };
}
