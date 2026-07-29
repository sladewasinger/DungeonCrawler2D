import { TILE } from "../../core/types.js";

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

export function carveSouthExitHall(context: { set: SetRoomTile; centerLx: number; wallLy: number }): void {
  const { set, centerLx, wallLy } = context;
  for (let depth = 0; depth < SOUTH_EXIT_HALL_DEPTH; depth++) {
    set({ lx: centerLx, ly: wallLy + depth, tile: TILE.Floor });
  }
}

export function southExitDoorY(
  baseY: number,
  top: number,
  roomHeight: number,
): number {
  return baseY + top + roomHeight - 1 + SOUTH_EXIT_HALL_DEPTH;
}
