import { TERRAIN, TILE, type TerrainType, type TileType, type WorldView } from "@dc2d/engine";
import type { Terrain4World } from "../../render/terrain4/runtime/terrain4World.js";

export const CHARACTER_VFX_ROOM = {
  left: 1,
  top: 2,
  width: 34,
  height: 12,
} as const;

const ROOM_RIGHT = CHARACTER_VFX_ROOM.left + CHARACTER_VFX_ROOM.width;
const ROOM_BOTTOM = CHARACTER_VFX_ROOM.top + CHARACTER_VFX_ROOM.height;
const ROOM_WALL_HEIGHT = 1;
const DOOR_X = CHARACTER_VFX_ROOM.left + Math.floor(CHARACTER_VFX_ROOM.width / 2);
const FEATURE_TILES: ReadonlyMap<string, TileType> = new Map([
  [`${DOOR_X},${CHARACTER_VFX_ROOM.top}`, TILE.DoorSafeRoom],
  [`${CHARACTER_VFX_ROOM.left + 3},${CHARACTER_VFX_ROOM.top + 3}`, TILE.Stash],
  [`${ROOM_RIGHT - 4},${CHARACTER_VFX_ROOM.top + 3}`, TILE.CraftingTable],
]);

/** A deterministic safe-room-shaped WorldView consumed by the real Terrain4Renderer. */
export class CharacterVfxBenchWorld implements Terrain4World, WorldView {
  readonly tileRevision = 1;
  readonly worldSeed = 228182761;
  readonly floor = 1;

  terrainAt(x: number, y: number): TerrainType {
    return inRoom(x, y) ? TERRAIN.Floor : TERRAIN.Void;
  }

  tileAt(x: number, y: number): TileType {
    if (!inRoom(x, y)) return TILE.Void;
    return featureAt(x, y);
  }

  heightAt(x: number, y: number): number {
    return isRoomWall(x, y) ? ROOM_WALL_HEIGHT : 0;
  }

  isWalkable(x: number, y: number): boolean {
    return inRoom(x, y) && this.tileAt(x, y) !== TILE.Void;
  }

  groundAt(x: number, y: number): number {
    return this.heightAt(Math.floor(x), Math.floor(y));
  }

  stairHeightAt(): number | null {
    return null;
  }
}

function inRoom(x: number, y: number): boolean {
  return x >= CHARACTER_VFX_ROOM.left && x < ROOM_RIGHT &&
    y >= CHARACTER_VFX_ROOM.top && y < ROOM_BOTTOM;
}

function isRoomWall(x: number, y: number): boolean {
  if (!inRoom(x, y)) return false;
  return isRoomSide(x) || isRoomEnd(y);
}

function isRoomSide(x: number): boolean {
  return x === CHARACTER_VFX_ROOM.left || x === ROOM_RIGHT - 1;
}

function isRoomEnd(y: number): boolean {
  return y === CHARACTER_VFX_ROOM.top || y === ROOM_BOTTOM - 1;
}

function featureAt(x: number, y: number): TileType {
  return FEATURE_TILES.get(`${x},${y}`) ?? TILE.Floor;
}
