import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import type { ToonWorldBounds } from "./toonVisibilityField.js";

interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Camera footprint without terrain streaming's extra chunk-render margin. */
export function toonWorldBoundsForView(
  view: ViewRect,
  orientation: ViewOrientation,
): ToonWorldBounds {
  const corners = viewCorners(view, orientation);
  const minX = Math.min(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function viewCorners(
  view: ViewRect,
  orientation: ViewOrientation,
) {
  const minX = Math.floor(view.x / SCREEN_TILE_PX);
  const minY = Math.floor(view.y / SCREEN_TILE_PX);
  const maxX = Math.ceil((view.x + view.width) / SCREEN_TILE_PX);
  const maxY = Math.ceil((view.y + view.height) / SCREEN_TILE_PX);
  return [
    viewTileToWorld({ x: minX, y: minY }, orientation),
    viewTileToWorld({ x: maxX, y: minY }, orientation),
    viewTileToWorld({ x: minX, y: maxY }, orientation),
    viewTileToWorld({ x: maxX, y: maxY }, orientation),
  ];
}
