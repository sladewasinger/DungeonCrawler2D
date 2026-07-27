import { CHUNK_SIZE, TERRAIN, TILE, ZONE, type Chunk } from "../../core/types.js";
import { ROOM_WALL_RISE, carveSouthExitHall, type RoomTile, type SetRoomTile } from "./roomExitGeometry.js";
import { roomSlotAt, type RoomSlot } from "./rooms.js";

interface RoomRect { left: number; top: number; w: number; h: number; }
interface RoomGrid { tiles: Uint8Array; terrain: Uint8Array; features: Uint8Array; height: Float32Array; zones: Uint8Array; }
interface FixtureContext extends RoomRect { set: SetRoomTile; kind: RoomSlot["kind"]; }

export function generateRoomChunk(cx: number, cy: number): Chunk {
  const grid = createRoomGrid();
  const slot = roomSlotAt(cx, cy);
  if (slot) stampRoom(grid, slot);
  populateFeatures(grid);
  return { cx, cy, ...grid };
}

function createRoomGrid(): RoomGrid {
  const cells = CHUNK_SIZE * CHUNK_SIZE;
  return {
    tiles: new Uint8Array(cells).fill(TILE.Void), terrain: new Uint8Array(cells).fill(TERRAIN.Void),
    features: new Uint8Array(cells), height: new Float32Array(cells), zones: new Uint8Array(cells),
  };
}

function stampRoom(grid: RoomGrid, slot: RoomSlot): void {
  const rect = centeredRoomRect(slot);
  const set = roomTileSetter(grid);
  stampPerimeter(set, rect);
  carveInterior(set, rect);
  placeFixtures({ set, kind: slot.kind, ...rect });
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

function stampPerimeter(set: SetRoomTile, rect: RoomRect): void {
  for (let ly = rect.top; ly < rect.top + rect.h; ly++) {
    for (let lx = rect.left; lx < rect.left + rect.w; lx++) set({ lx, ly, tile: TILE.Floor, tileHeight: ROOM_WALL_RISE });
  }
}

function carveInterior(set: SetRoomTile, rect: RoomRect): void {
  for (let ly = rect.top + 1; ly < rect.top + rect.h - 1; ly++) {
    for (let lx = rect.left + 1; lx < rect.left + rect.w - 1; lx++) set({ lx, ly, tile: TILE.Floor });
  }
}

function placeFixtures(context: FixtureContext): void {
  const { set, kind, left, top, w, h } = context;
  const centerLx = Math.floor(CHUNK_SIZE / 2);
  set({ lx: centerLx, ly: top + h - 2, tile: TILE.DoorExit });
  carveSouthExitHall({ set, centerLx, wallLy: top + h - 1 });
  if (kind !== "personal") return;
  set({ lx: left + 1, ly: top + 1, tile: TILE.Stash });
  set({ lx: left + w - 2, ly: top + 1, tile: TILE.CraftingTable });
}

function populateFeatures(grid: RoomGrid): void {
  for (let index = 0; index < grid.tiles.length; index++) {
    const tile = grid.tiles[index] ?? TILE.Floor;
    grid.features[index] = grid.terrain[index] === TERRAIN.Floor && tile !== TILE.Floor ? tile : TILE.Floor;
  }
}
