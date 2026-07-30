import type { ToonMaskTile } from "./maskGeometry.js";
import {
  cellKey,
  type MaskOccupancy,
} from "./contourTypes.js";

export interface MaskOccupancyRequest {
  readonly tiles: readonly ToonMaskTile[];
  readonly cellSize: number;
}

interface MaskCellElevationRequest {
  readonly elevations: Map<string, number | null>;
  readonly x: number;
  readonly y: number;
  readonly groundHeight: number;
}

export function createMaskOccupancy(
  request: MaskOccupancyRequest,
): MaskOccupancy {
  const elevations = new Map<string, number | null>();
  for (const tile of request.tiles) {
    appendMaskTileCells(elevations, tile, request.cellSize);
  }
  return { cells: new Set(elevations.keys()), elevations };
}

function appendMaskTileCells(
  elevations: Map<string, number | null>,
  tile: ToonMaskTile,
  cellSize: number,
): void {
  const x = Math.round(tile.viewX / cellSize);
  const topY = Math.round(tile.topY / cellSize);
  const height = Math.max(1, Math.round(tile.height / cellSize));
  for (let offset = 0; offset < height; offset += 1) {
    appendMaskCellElevation({
      elevations,
      x,
      y: topY + offset,
      groundHeight: tile.groundHeight,
    });
  }
}

function appendMaskCellElevation(request: MaskCellElevationRequest): void {
  const key = cellKey(request.x, request.y);
  const previous = request.elevations.get(key);
  if (previous === undefined) {
    request.elevations.set(key, request.groundHeight);
    return;
  }
  if (previous !== request.groundHeight) request.elevations.set(key, null);
}
