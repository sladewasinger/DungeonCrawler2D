import { describe, expect, it } from "vitest";
import { TICK_DT, WALL_DOOR_FEATURE_HEIGHT } from "../../../core/constants.js";
import { hashString } from "../../../core/rng.js";
import { createBody, stepBody } from "../../../entities/movement/index.js";
import {
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
} from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  roomDoorWallAt,
  safeRoomDoorPlacements,
} from "./roomDoorPlacements.js";
import { SAFE_ROOM_H, SAFE_ROOM_W } from "./roomModel.js";
import { generateRoomChunk } from "./roomChunkBuilder.js";
import { safeRoomChunk, safeRoomFeatures } from "./rooms.js";

describe("safe-room door placements", () => {
  it("keeps wall-feature sites empty until replicated overrides arrive", () => {
    const { cx, cy } = safeRoomChunk(4, 7);
    const chunk = generateRoomChunk(cx, cy);
    const features = safeRoomFeatures(4, 7);
    const coordinates = features.doors.map((door) => `${door.x},${door.y}`);

    expect(features.doors).toHaveLength(20);
    expect(new Set(coordinates).size).toBe(20);
    expect(features.doors.every((door) =>
      chunk.features[localIndex({ cx, cy }, door)] === TILE.Floor
    )).toBe(true);
    expect(chunk.features).not.toContain(TILE.DoorPersonal);
    expect(chunk.features).not.toContain(TILE.DoorParty);
  });

  it("anchors all twenty features on their declared collision wall", () => {
    const room = safeRoomChunk(4, 7);
    const chunk = generateRoomChunk(room.cx, room.cy);
    const doors = safeRoomDoorPlacements(room.cx, room.cy);

    expect(doors).toHaveLength(20);
    for (const door of doors) {
      const index = localIndex(room, door);
      const northWall = door.wall === "north";
      expect(chunk.terrain[index], `${door.wall} terrain`)
        .toBe(TERRAIN.Floor);
      expect(chunk.tiles[index], `${door.wall} tile`)
        .toBe(northWall ? TILE.Floor : TILE.Bedrock);
      expect(chunk.height[index], `${door.wall} height`).toBe(3);
      expect(inwardTerrain(chunk, room, door)).toBe(TERRAIN.Floor);
      expect(roomDoorWallAt({ kind: "safe", ...room, x: door.x, y: door.y })).toBe(door.wall);
    }
  });

  it("keeps the first solo portal on the raised north wall", () => {
    const room = safeRoomChunk(4, 7);
    const door = safeRoomDoorPlacements(room.cx, room.cy)[0];
    if (!door) throw new Error("safe room has no first door");
    const left = room.cx * CHUNK_SIZE + Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_W / 2);
    const top = room.cy * CHUNK_SIZE + Math.floor(CHUNK_SIZE / 2 - SAFE_ROOM_H / 2);

    expect(door).toEqual({
      x: left + 8,
      y: top,
      wall: "north",
      featureFace: FEATURE_FACE.South,
    });
    expect(generateRoomChunk(room.cx, room.cy).height[localIndex(room, door)]).toBe(3);
  });

  it("overlays a door without punching through either raised or sealed collision", () => {
    const world = new World(hashString("room-wall-feature"), 1);
    const room = safeRoomChunk(4, 7);
    const doors = safeRoomDoorPlacements(room.cx, room.cy);
    const north = doors.find((door) => door.wall === "north");
    const west = doors.find((door) => door.wall === "west");
    if (!north || !west) throw new Error("safe room wall placements are incomplete");
    world.replaceFeatureOverrides([north, west].map((door) => ({
      x: door.x,
      y: door.y,
      tile: TILE.DoorPersonal,
      featureFace: door.featureFace,
      featureHeight: WALL_DOOR_FEATURE_HEIGHT,
    })));

    expect(world.tileAt(north.x, north.y)).toBe(TILE.DoorPersonal);
    expect(world.featureFaceAt(north.x, north.y)).toBe(north.featureFace);
    expect(world.heightAt(north.x, north.y)).toBe(3);
    expect(world.tileAt(west.x, west.y)).toBe(TILE.DoorPersonal);
    expect(world.terrainAt(west.x, west.y)).toBe(TERRAIN.Floor);
    expect(world.surfaceTileAt(west.x, west.y)).toBe(TILE.Bedrock);
    expect(world.isWalkable(west.x, west.y)).toBe(false);

    const body = createBody(north.x + 0.5, north.y + 1.5, 0);
    for (let tick = 0; tick < 60; tick++) {
      stepBody(world, body, { moveX: 0, moveY: -1, jump: false }, TICK_DT);
    }
    expect(Math.floor(body.y)).toBe(north.y + 1);
  });
});

function inwardTerrain(
  chunk: ReturnType<typeof generateRoomChunk>,
  room: { cx: number; cy: number },
  door: ReturnType<typeof safeRoomDoorPlacements>[number],
): number {
  const offsets = {
    north: { x: 0, y: 1 }, east: { x: -1, y: 0 },
    south: { x: 0, y: -1 }, west: { x: 1, y: 0 },
  } as const;
  const offset = offsets[door.wall];
  return chunk.terrain[localIndex(room, { x: door.x + offset.x, y: door.y + offset.y })] ?? -1;
}

function localIndex(
  room: { cx: number; cy: number },
  point: { x: number; y: number },
): number {
  return (point.y - room.cy * CHUNK_SIZE) * CHUNK_SIZE +
    point.x - room.cx * CHUNK_SIZE;
}
