import { TILE, ZONE } from "../types.js";

export const ROOM_WALL_RISE = 3;
export const SOUTH_EXIT_HALL_DEPTH = 2;

export type SetRoomTile = (
  lx: number,
  ly: number,
  tile: number,
  zone?: number,
  tileHeight?: number,
) => void;

function stampBoundary(set: SetRoomTile, lx: number, ly: number): void {
  set(lx, ly, TILE.Floor, ZONE.None, ROOM_WALL_RISE);
}

export function carveSouthExitHall(
  set: SetRoomTile,
  centerLx: number,
  wallLy: number,
): void {
  for (let depth = 0; depth < SOUTH_EXIT_HALL_DEPTH; depth++) {
    const hallLy = wallLy + depth;
    set(centerLx, hallLy, TILE.Floor);
    stampBoundary(set, centerLx - 1, hallLy);
    stampBoundary(set, centerLx + 1, hallLy);
  }
  const endLy = wallLy + SOUTH_EXIT_HALL_DEPTH;
  for (let dx = -1; dx <= 1; dx++) stampBoundary(set, centerLx + dx, endLy);
}
