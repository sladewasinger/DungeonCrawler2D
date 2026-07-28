import { CHUNK_SIZE, TILE, ZONE } from "../../core/types.js";
import { isNearDescent, isNearLandmark } from "../landmarks/guard.js";
import type { Rect } from "../types.js";
import {
  at,
  BLOCK,
  blockCells,
  type Cell,
  EPS,
  type Grid,
  ringCells,
} from "./showcaseScan.js";

export interface FeatureSite {
  readonly g: Grid;
  readonly worldSeed: number;
  readonly floor: number;
  readonly bx: number;
  readonly by: number;
}

/** True when every requested cell is plain, flat, unreserved floor. */
export function cellsCarvable(g: Grid, cells: readonly Cell[]): boolean {
  return cells.every(([x, y]) => {
    if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return false;
    if (at(g.tiles, x, y) !== TILE.Floor ||
      at(g.zones, x, y) !== ZONE.None) return false;
    return Math.abs(at(g.height, x, y)) <= EPS;
  });
}

export function guardsClear({ worldSeed, floor, bx, by }: FeatureSite): boolean {
  const rect: Rect = {
    x0: bx - 1,
    y0: by - 1,
    x1: bx + BLOCK,
    y1: by + BLOCK,
  };
  const context = { worldSeed, floor, cx: 0, cy: 0, rect };
  return !isNearLandmark(context) && !isNearDescent(context);
}

/** True when a feature block and its ring may be carved without disruption. */
export function platformViable(site: FeatureSite): boolean {
  const { g, bx, by } = site;
  const cells = [...blockCells(bx, by), ...ringCells(bx, by)];
  return cellsCarvable(g, cells) && guardsClear(site);
}
