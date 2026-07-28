import { WALL_DOOR_FEATURE_HEIGHT } from "../../../core/constants.js";
import {
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
  ZONE,
  type Chunk,
} from "../../core/types.js";
import {
  ROOM_WALL_RISE,
  SOUTH_EXIT_HALL_DEPTH,
  carveSouthExitHall,
  type RoomTile,
  type SetRoomTile,
} from "./roomExitGeometry.js";
import { roomSlotAt } from "./rooms.js";
import type { RoomSlot } from "./roomModel.js";

interface RoomRect { left: number; top: number; w: number; h: number; }
interface RoomGrid {
  tiles: Uint8Array;
  terrain: Uint8Array;
  features: Uint8Array;
  featureFaces: Uint8Array;
  featureHeight: Float32Array;
  height: Float32Array;
  zones: Uint8Array;
}
interface FixtureContext extends RoomRect {
  grid: RoomGrid;
  set: SetRoomTile;
  kind: RoomSlot["kind"];
}

export function generateRoomChunk(cx: number, cy: number, voidTerrain = true): Chunk {
  const grid = createRoomGrid(voidTerrain);
  const slot = roomSlotAt(cx, cy);
  if (slot) stampRoom(grid, slot, voidTerrain);
  populateFeatures(grid);
  return { cx, cy, ...grid };
}

function createRoomGrid(voidTerrain: boolean): RoomGrid {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  const height = new Float32Array(cells);
  if (!voidTerrain) height.fill(ROOM_WALL_RISE);
  return {
    tiles: new Uint8Array(cells).fill(voidTerrain ? TILE.Void : TILE.Floor),
    terrain: new Uint8Array(cells).fill(voidTerrain ? TERRAIN.Void : TERRAIN.Floor),
    features: new Uint8Array(cells),
    featureFaces: new Uint8Array(cells),
    featureHeight: new Float32Array(cells),
    height,
    zones: new Uint8Array(cells),
  };
}

function stampRoom(grid: RoomGrid, slot: RoomSlot, voidTerrain: boolean): void {
  const rect = centeredRoomRect(slot);
  const set = roomTileSetter(grid);
  if (voidTerrain) stampBackWall(set, rect);
  else stampRaisedRoom(set, rect);
  carveInterior(set, rect);
  placeFixtures({ grid, set, kind: slot.kind, ...rect });
}

function centeredRoomRect(slot: RoomSlot): RoomRect {
  return { left: Math.floor(CHUNK_SIZE / 2 - slot.w / 2), top: Math.floor(CHUNK_SIZE / 2 - slot.h / 2), w: slot.w, h: slot.h };
}

function roomTileSetter(grid: RoomGrid): SetRoomTile { return (cell: RoomTile) => writeRoomTile(grid, cell); }

function writeRoomTile(grid: RoomGrid, cell: RoomTile): void {
  const index = cell.ly * CHUNK_SIZE + cell.lx;
  grid.tiles[index] = cell.tile;
  grid.terrain[index] = TERRAIN.Floor;
  grid.zones[index] = cell.zone ?? ZONE.Sanctuary;
  grid.height[index] = cell.tileHeight ?? 0;
}

function stampBackWall(set: SetRoomTile, rect: RoomRect): void {
  for (let lx = rect.left; lx < rect.left + rect.w; lx++) {
    set({ lx, ly: rect.top, tile: TILE.Floor, tileHeight: ROOM_WALL_RISE });
  }
}

function stampRaisedRoom(set: SetRoomTile, rect: RoomRect): void {
  for (let ly = rect.top; ly < rect.top + rect.h; ly++) {
    for (let lx = rect.left; lx < rect.left + rect.w; lx++) {
      set({ lx, ly, tile: TILE.Floor, tileHeight: ROOM_WALL_RISE });
    }
  }
}

function carveInterior(set: SetRoomTile, rect: RoomRect): void {
  for (let ly = rect.top + 1; ly < rect.top + rect.h - 1; ly++) {
    for (let lx = rect.left + 1; lx < rect.left + rect.w - 1; lx++) {
      set({ lx, ly, tile: TILE.Floor });
    }
  }
}

function placeFixtures(context: FixtureContext): void {
  const { set, kind, left, top, w, h } = context;
  const centerLx = Math.floor(CHUNK_SIZE / 2);
  const wallLy = top + h - 1;
  carveSouthExitHall({ set, centerLx, wallLy });
  placeExitDoor(context.grid, centerLx, wallLy + SOUTH_EXIT_HALL_DEPTH);
  if (kind !== "personal") return;
  set({ lx: left + 1, ly: top + 1, tile: TILE.Stash });
  set({ lx: left + w - 2, ly: top + 1, tile: TILE.CraftingTable });
}

function placeExitDoor(
  grid: RoomGrid,
  lx: number,
  ly: number,
): void {
  const index = ly * CHUNK_SIZE + lx;
  grid.features[index] = TILE.DoorExit;
  grid.featureFaces[index] = FEATURE_FACE.North;
  grid.featureHeight[index] = WALL_DOOR_FEATURE_HEIGHT;
}

function populateFeatures(grid: RoomGrid): void {
  for (let index = 0; index < grid.tiles.length; index++) {
    const tile = grid.tiles[index] ?? TILE.Floor;
    if (grid.terrain[index] !== TERRAIN.Floor || tile === TILE.Floor) continue;
    grid.features[index] = tile;
    grid.featureHeight[index] = grid.height[index] ?? 0;
    grid.tiles[index] = TILE.Floor;
  }
}
