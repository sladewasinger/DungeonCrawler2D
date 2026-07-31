import { ADMIN_MAP_MAX_RADIUS } from "@dc2d/engine";

export const ADMIN_MAP_DEFAULT_TILE_SIZE = 24;

const ADMIN_MAP_MIN_TILE_SIZE = 18;
const ADMIN_MAP_MAX_TILE_SIZE = 48;
const ADMIN_MAP_ZOOM_STEP = 6;
const VIEWPORT_EDGE_CELL_ALLOWANCE = 1;

export type AdminMapZoomDirection = "in" | "out";

export function nextAdminMapTileSize(
  tileSize: number,
  direction: AdminMapZoomDirection,
): number {
  const change = direction === "in" ? ADMIN_MAP_ZOOM_STEP : -ADMIN_MAP_ZOOM_STEP;
  return Math.max(
    ADMIN_MAP_MIN_TILE_SIZE,
    Math.min(ADMIN_MAP_MAX_TILE_SIZE, tileSize + change),
  );
}

export function adminMapZoomPercent(tileSize: number): number {
  return Math.round(tileSize / ADMIN_MAP_DEFAULT_TILE_SIZE * 100);
}

export function adminMapViewportRadius(input: {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
}): number {
  const halfVisibleCells = Math.max(input.width, input.height) / input.tileSize / 2;
  return Math.min(
    ADMIN_MAP_MAX_RADIUS,
    Math.ceil(halfVisibleCells) + VIEWPORT_EDGE_CELL_ALLOWANCE,
  );
}
