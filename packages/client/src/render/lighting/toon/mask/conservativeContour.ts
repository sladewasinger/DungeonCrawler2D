import type { ToonMaskTile } from "./maskGeometry.js";
import { traceMaskBoundaryPaths } from "./boundaryTracing.js";
import { simplifyConservativeDiagonal } from "./conservativeDiagonal.js";
import { createMaskOccupancy } from "./maskOccupancy.js";
import {
  signedTwiceArea,
  type ToonMaskPath,
  type ToonMaskPoint,
} from "./contourTypes.js";

export interface ConservativeMaskContourRequest {
  readonly tiles: readonly ToonMaskTile[];
  readonly cellSize: number;
}

/**
 * Returns null for any field containing a transparent interior ring. Those
 * fields retain the exact rectangle mask so a hidden tile can never leak.
 */
export function buildConservativeMaskPaths(
  request: ConservativeMaskContourRequest,
): ToonMaskPath[] | null {
  if (!request.tiles.every((tile) =>
    tileUsesWholeMaskCells(tile, request.cellSize))) {
    return null;
  }
  const occupancy = createMaskOccupancy(request);
  const paths = traceMaskBoundaryPaths(occupancy.cells);
  if (paths.some((path) => signedTwiceArea(path) <= 0)) return null;
  return paths.map((path) => ({
    points: scalePath(
      simplifyConservativeDiagonal({ path, occupancy }),
      request.cellSize,
    ),
  }));
}

function tileUsesWholeMaskCells(
  tile: ToonMaskTile,
  cellSize: number,
): boolean {
  return [tile.viewX, tile.topY, tile.height]
    .every((value) => Number.isInteger(value / cellSize));
}

function scalePath(
  path: readonly ToonMaskPoint[],
  cellSize: number,
): ToonMaskPoint[] {
  return path.map((point) => ({
    x: point.x * cellSize,
    y: point.y * cellSize,
  }));
}
