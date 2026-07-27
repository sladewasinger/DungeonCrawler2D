// Door/kiosk tiles double as teal light sources — "portal/kiosk teal glow" per
// VISUAL_DIRECTION. One light per door tile; doors are sparse, so no hash-spacing needed.
import { TILE, type TileType } from "@dc2d/engine";
import type { TilePos, TileRect } from "./torchPlacement.js";

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
export function doorLightPositions(world: DoorTileRead, bounds: TileRect): TilePos[] {
  const out: TilePos[] = [];
  for (let wy = bounds.y0; wy < bounds.y1; wy++) {
    for (let wx = bounds.x0; wx < bounds.x1; wx++) {
      appendDoorLight({ world, positions: out, tile: { wx, wy } });
    }
  }
  return out;
}

function appendDoorLight(input: DoorLightCandidate): void {
  if (DOOR_TILES.has(input.world.tileAt(input.tile.wx, input.tile.wy))) {
    input.positions.push(input.tile);
  }
}

interface DoorLightCandidate {
  readonly world: DoorTileRead;
  readonly positions: TilePos[];
  readonly tile: TilePos;
}
