import { groundToScreen } from "../../../../render/entities/geometry/worldToScreen.js";
import type { AreaCellPosition } from "./areaViewGeometry.js";

export interface AreaCellSurface {
  readonly cell: AreaCellPosition;
  readonly groundHeight: number;
  readonly screen: Readonly<{ x: number; y: number }>;
}

export type AreaGroundSampler = (x: number, y: number) => number;

export function areaCellSurface(
  cell: AreaCellPosition,
  groundAt: AreaGroundSampler,
): AreaCellSurface {
  const x = cell.x + 0.5;
  const y = cell.y + 0.5;
  const groundHeight = groundAt(x, y);
  return {
    cell,
    groundHeight,
    screen: groundToScreen(x, y, groundHeight),
  };
}
