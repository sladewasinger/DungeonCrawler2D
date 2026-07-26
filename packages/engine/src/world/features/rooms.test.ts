import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../core/constants.js";
import { hashString } from "../../core/rng.js";
import { createBody, stepBody } from "../../entities/movement/index.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { World } from "../world.js";
import {
  ROOM_WALL_RISE,
  SOUTH_EXIT_HALL_DEPTH,
} from "./roomExitGeometry.js";
import {
  PARTY_ROOM_H,
  PARTY_ROOM_W,
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  displayCoordinates,
  generateRoomChunk,
  partyRoomChunk,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomChunk,
  safeRoomFeatures,
} from "./rooms.js";

const tileAt = (
  chunk: ReturnType<typeof generateRoomChunk>,
  wx: number,
  wy: number,
): number => {
  const lx = wx - chunk.cx * CHUNK_SIZE;
  const ly = wy - chunk.cy * CHUNK_SIZE;
  return chunk.tiles[ly * CHUNK_SIZE + lx] ?? -1;
};

const countTile = (tiles: Uint8Array, tile: number): number =>
  [...tiles].filter((entry) => entry === tile).length;

interface RoomCase {
  kind: string;
  position: { cx: number; cy: number };
  width: number;
  height: number;
}

const ROOM_CASES: readonly RoomCase[] = [
  {
    kind: "personal",
    position: personalRoomChunk(0),
    width: PERSONAL_ROOM_W,
    height: PERSONAL_ROOM_H,
  },
  {
    kind: "party",
    position: partyRoomChunk(0),
    width: PARTY_ROOM_W,
    height: PARTY_ROOM_H,
  },
  {
    kind: "safe",
    position: safeRoomChunk(4, 7),
    width: SAFE_ROOM_W,
    height: SAFE_ROOM_H,
  },
];

const exitPosition = (
  chunk: ReturnType<typeof generateRoomChunk>,
): { x: number; y: number } => {
  const index = chunk.tiles.findIndex((tile) => tile === TILE.DoorExit);
  if (index < 0) throw new Error("room exit is missing");
  return {
    x: chunk.cx * CHUNK_SIZE + index % CHUNK_SIZE,
    y: chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE),
  };
};

const runMovement = (
  world: World,
  body: ReturnType<typeof createBody>,
  moveX: number,
  moveY: number,
  jump: boolean,
): void => {
  stepBody(world, body, { moveX, moveY, jump }, TICK_DT);
  for (let tick = 0; tick < 60; tick++) {
    stepBody(world, body, { moveX, moveY, jump: false }, TICK_DT);
  }
};

describe("safe room doors", () => {
  it("keeps occupant portal sites as floor until replicated overrides arrive", () => {
    const { cx, cy } = safeRoomChunk(4, 7);
    const chunk = generateRoomChunk(cx, cy);
    const features = safeRoomFeatures(4, 7);
    expect(features.doors).toHaveLength(20);
    expect(new Set(features.doors.map((door) => `${door.x},${door.y}`)).size).toBe(20);
    expect(features.doors.every((door) => tileAt(chunk, door.x, door.y) === TILE.Floor))
      .toBe(true);
    expect(countTile(chunk.tiles, TILE.DoorPersonal)).toBe(0);
    expect(countTile(chunk.tiles, TILE.DoorParty)).toBe(0);
    expect(countTile(chunk.tiles, TILE.Stash)).toBe(0);
    expect(countTile(chunk.tiles, TILE.CraftingTable)).toBe(0);
  });

});

describe("south exit geometry", () => {
  it.each(ROOM_CASES)(
    "keeps the $kind room interior and hall as the complete carved mask",
    ({ position, width, height }) => {
      const chunk = generateRoomChunk(position.cx, position.cy);
      const left = Math.floor(CHUNK_SIZE / 2 - width / 2);
      const top = Math.floor(CHUNK_SIZE / 2 - height / 2);
      const centerLx = Math.floor(CHUNK_SIZE / 2);

      for (let ly = 0; ly < CHUNK_SIZE; ly++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const insideRoom = lx > left && lx < left + width - 1 &&
            ly > top && ly < top + height - 1;
          const insideHall = lx === centerLx &&
            ly >= top + height - 1 &&
            ly < top + height - 1 + SOUTH_EXIT_HALL_DEPTH;
          if (!insideRoom && !insideHall) {
            expect(chunk.tiles[ly * CHUNK_SIZE + lx]).toBe(TILE.Wall);
          }
        }
      }
    },
  );

  it.each(ROOM_CASES)(
    "stamps every $kind hall side and endpoint as an authoritative raised wall",
    ({ position }) => {
      const world = new World(hashString("room-exit-collision"), 1);
      const exit = exitPosition(world.getChunk(position.cx, position.cy));

      expect(world.tileAt(exit.x, exit.y)).toBe(TILE.DoorExit);
      expect(world.isWalkable(exit.x, exit.y)).toBe(false);
      for (let depth = 1; depth <= SOUTH_EXIT_HALL_DEPTH; depth++) {
        const hallY = exit.y + depth;
        expect(world.tileAt(exit.x, hallY)).toBe(TILE.Floor);
        expect(world.isWalkable(exit.x, hallY)).toBe(true);
        for (const sideX of [exit.x - 1, exit.x + 1]) {
          expect(world.tileAt(sideX, hallY)).toBe(TILE.Wall);
          expect(world.heightAt(sideX, hallY)).toBeGreaterThanOrEqual(ROOM_WALL_RISE);
          expect(world.isWalkable(sideX, hallY)).toBe(false);
        }
      }
      const endY = exit.y + SOUTH_EXIT_HALL_DEPTH + 1;
      for (const endX of [exit.x - 1, exit.x, exit.x + 1]) {
        expect(world.tileAt(endX, endY)).toBe(TILE.Wall);
        expect(world.heightAt(endX, endY)).toBeGreaterThanOrEqual(ROOM_WALL_RISE);
        expect(world.isWalkable(endX, endY)).toBe(false);
      }
    },
  );
});

describe("south exit collision", () => {
  it.each(ROOM_CASES)(
    "blocks axis movement and jumping through both $kind hall sides",
    ({ position }) => {
      const world = new World(hashString("room-exit-collision"), 1);
      const exit = exitPosition(world.getChunk(position.cx, position.cy));

      for (let depth = 1; depth <= SOUTH_EXIT_HALL_DEPTH; depth++) {
        const hallY = exit.y + depth;
        for (const direction of [-1, 1]) {
          const body = createBody(exit.x + 0.5, hallY + 0.5, 0);
          runMovement(world, body, direction, 0, true);
          expect(Math.floor(body.x)).toBe(exit.x);
          expect(Math.floor(body.y)).toBe(hallY);
          expect(world.tileAt(Math.floor(body.x), Math.floor(body.y))).toBe(TILE.Floor);
        }
      }
    },
  );

  it.each(ROOM_CASES)(
    "blocks diagonal corner slides and jumping beyond the $kind hall endpoint",
    ({ position }) => {
      const world = new World(hashString("room-exit-collision"), 1);
      const exit = exitPosition(world.getChunk(position.cx, position.cy));

      for (const direction of [-1, 1]) {
        const body = createBody(exit.x + 0.5, exit.y + 1.5, 0);
        runMovement(world, body, direction, 1, true);
        expect(Math.floor(body.x)).toBe(exit.x);
        expect(Math.floor(body.y)).toBe(exit.y + SOUTH_EXIT_HALL_DEPTH);
        expect(world.tileAt(Math.floor(body.x), Math.floor(body.y))).toBe(TILE.Floor);
      }
    },
  );
});

describe("personal room fixtures", () => {
  it("keeps the exit and spawn positions unchanged", () => {
    const { cx, cy } = personalRoomChunk(0);
    const chunk = generateRoomChunk(cx, cy);
    const exit = personalRoomFeatures(0).exit;
    expect(tileAt(chunk, exit.x, exit.y)).toBe(TILE.DoorExit);
    const spawn = personalRoomSpawn(0);
    expect(spawn).toEqual({ x: exit.x + 0.5, y: exit.y - 0.5 });
  });
});

describe("room display coordinates", () => {
  it("keeps overworld positions global and room positions chunk-local", () => {
    expect(displayCoordinates(-17.25, 42.5)).toEqual({ x: -17.25, y: 42.5 });
    const spawn = personalRoomSpawn(3);
    expect(displayCoordinates(spawn.x, spawn.y)).toEqual({ x: 0.5, y: 1.5 });
  });
});
