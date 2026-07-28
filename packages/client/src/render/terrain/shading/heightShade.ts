import { TILE, type TileType } from "@dc2d/engine";

/** A cell is void only when its explicit terrain tile says so. */
export function isVoidTile(tile: TileType): boolean {
  return tile === TILE.Void;
}
