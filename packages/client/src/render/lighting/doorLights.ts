// Door/kiosk tiles double as teal light sources — "portal/kiosk teal glow" per
// VISUAL_DIRECTION. One light per door tile; doors are sparse, so no hash-spacing needed.
import { TILE, type TileType } from "@dc2d/engine";
import type { TilePos } from "./torchPlacement.js";

const DOOR_TILES: ReadonlySet<TileType> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

export interface DoorTileRead {
  tileAt(wx: number, wy: number): TileType;
}

/** Every door tile in [x0,x1) x [y0,y1) — each becomes a teal portal light. */
export function doorLightPositions(world: DoorTileRead, x0: number, y0: number, x1: number, y1: number): TilePos[] {
  const out: TilePos[] = [];
  for (let wy = y0; wy < y1; wy++) {
    for (let wx = x0; wx < x1; wx++) {
      if (DOOR_TILES.has(world.tileAt(wx, wy))) out.push({ wx, wy });
    }
  }
  return out;
}
