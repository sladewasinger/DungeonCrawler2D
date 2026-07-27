import { TILE, ZONE } from "../types.js";

export const ROOM_WALL_RISE = 3;
export const SOUTH_EXIT_HALL_DEPTH = 2;

export interface RoomTile {
  lx: number;
  ly: number;
  tile: number;
  zone?: number;
  tileHeight?: number;
}

export type SetRoomTile = (cell: RoomTile) => void;

function stampBoundary(set: SetRoomTile, lx: number, ly: number): void {
  set({ lx, ly, tile: TILE.Floor, zone: ZONE.None, tileHeight: ROOM_WALL_RISE });
}

export function carveSouthExitHall(context: { set: SetRoomTile; centerLx: number; wallLy: number }): void {
  const { set, centerLx, wallLy } = context;
  for (let depth = 0; depth < SOUTH_EXIT_HALL_DEPTH; depth++) {
    const hallLy = wallLy + depth;
    set({ lx: centerLx, ly: hallLy, tile: TILE.Floor });
    stampBoundary(set, centerLx - 1, hallLy);
    stampBoundary(set, centerLx + 1, hallLy);
  }
  const endLy = wallLy + SOUTH_EXIT_HALL_DEPTH;
  for (let dx = -1; dx <= 1; dx++) stampBoundary(set, centerLx + dx, endLy);
}
