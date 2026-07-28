import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TERRAIN, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import { SOUTH_EXIT_HALL_DEPTH } from "./roomExitGeometry.js";
import { PERSONAL_ROOM_H } from "./roomModel.js";
import {
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomChunk,
  safeRoomFeatures,
  safeRoomSpawn,
} from "./rooms.js";

const SEED = hashString("test-world");
const FLOOR = 1;

describe("room world integration", () => {
  it("provides stable room identities, dynamic portal sites, and sanctuary", () => {
    const world = new World(SEED, FLOOR);
    const doorCx = 3;
    const doorCy = -2;
    const features = safeRoomFeatures(doorCx, doorCy);

    expect(features.doors).toHaveLength(20);
    expect(features.doors.every((door) =>
      world.featureAt(door.x, door.y) === TILE.Floor
    )).toBe(true);
    expect(world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);

    const spawn = safeRoomSpawn(doorCx, doorCy);
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);

    const roomA = safeRoomChunk(doorCx, doorCy);
    expect(safeRoomChunk(doorCx + 1, doorCy)).not.toEqual(roomA);
    expect(safeRoomChunk(doorCx, doorCy)).toEqual(roomA);
  });

  it("mounts the personal-room exit beyond an exact two-tile hall", () => {
    const world = new World(SEED, FLOOR);
    const chunk = personalRoomChunk(0);
    const baseY = chunk.cy * CHUNK_SIZE;
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    const features = personalRoomFeatures(0);
    const spawn = personalRoomSpawn(0);

    expect(features.exit.y).toBe(
      baseY + top + PERSONAL_ROOM_H - 1 + SOUTH_EXIT_HALL_DEPTH,
    );
    expect(world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);
    expect(world.terrainAt(features.exit.x, features.exit.y)).toBe(TERRAIN.Void);
    expect(world.isWalkable(features.exit.x, features.exit.y)).toBe(false);
    expect(world.tileAt(features.exit.x, features.exit.y - 1)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x, features.exit.y - 2)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x - 1, features.exit.y - 1)).toBe(TILE.Void);
    expect(world.tileAt(features.exit.x + 1, features.exit.y - 1)).toBe(TILE.Void);
    expect(Math.floor(spawn.x)).toBe(features.exit.x);
    expect(Math.floor(spawn.y)).toBeLessThan(features.exit.y - SOUTH_EXIT_HALL_DEPTH);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});
