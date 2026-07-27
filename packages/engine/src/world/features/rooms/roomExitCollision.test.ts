import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../../core/constants.js";
import { hashString } from "../../../core/rng.js";
import { createBody, stepBody } from "../../../entities/movement/index.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import { ROOM_WALL_RISE, SOUTH_EXIT_HALL_DEPTH } from "./roomExitGeometry.js";
import {
  generateRoomChunk,
  partyRoomChunk,
  personalRoomChunk,
  safeRoomChunk,
} from "./rooms.js";

const ROOM_CASES = [
  { kind: "personal", position: personalRoomChunk(0) },
  { kind: "party", position: partyRoomChunk(0) },
  { kind: "safe", position: safeRoomChunk(4, 7) },
] as const;
const WORLD_SEED = hashString("room-exit-collision");

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

const runMovement = (input: { world: World; body: ReturnType<typeof createBody>; moveX: number; moveY: number; jump: boolean }): void => {
  const { world, body, moveX, moveY, jump } = input;
  stepBody(world, body, { moveX, moveY, jump }, TICK_DT);
  for (let tick = 0; tick < 60; tick++) {
    stepBody(world, body, { moveX, moveY, jump: false }, TICK_DT);
  }
};

function assertRaisedHallSide(world: World, x: number, y: number): void {
  expect(world.tileAt(x, y)).toBe(TILE.Floor);
  expect(world.heightAt(x, y)).toBeGreaterThanOrEqual(ROOM_WALL_RISE);
  expect(world.isWalkable(x, y)).toBe(true);
}

function assertRaisedHallGeometry(world: World, exit: { x: number; y: number }): void {
  expect(world.tileAt(exit.x, exit.y)).toBe(TILE.DoorExit);
  expect(world.isWalkable(exit.x, exit.y)).toBe(false);
  for (let depth = 1; depth <= SOUTH_EXIT_HALL_DEPTH; depth++) {
    const y = exit.y + depth;
    expect(world.tileAt(exit.x, y)).toBe(TILE.Floor);
    expect(world.isWalkable(exit.x, y)).toBe(true);
    for (const x of [exit.x - 1, exit.x + 1]) assertRaisedHallSide(world, x, y);
  }
  const endY = exit.y + SOUTH_EXIT_HALL_DEPTH + 1;
  for (const endX of [exit.x - 1, exit.x, exit.x + 1]) assertRaisedHallSide(world, endX, endY);
}

describe("south exit collision", () => {
  it.each(ROOM_CASES)("stamps every $kind hall side and endpoint as a raised Floor boundary", ({ position }) => {
    const world = new World(WORLD_SEED, 1);
    assertRaisedHallGeometry(world, exitPosition(world.getChunk(position.cx, position.cy)));
  });

  it.each(ROOM_CASES)(
    "blocks axis movement and jumping through both $kind hall sides",
    ({ position }) => {
      const world = new World(WORLD_SEED, 1);
      const exit = exitPosition(world.getChunk(position.cx, position.cy));

      for (let depth = 1; depth <= SOUTH_EXIT_HALL_DEPTH; depth++) {
        const hallY = exit.y + depth;
        for (const direction of [-1, 1]) {
          const body = createBody(exit.x + 0.5, hallY + 0.5, 0);
          runMovement({ world, body, moveX: direction, moveY: 0, jump: true });
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
      const world = new World(WORLD_SEED, 1);
      const exit = exitPosition(world.getChunk(position.cx, position.cy));

      for (const direction of [-1, 1]) {
        const body = createBody(exit.x + 0.5, exit.y + 1.5, 0);
        runMovement({ world, body, moveX: direction, moveY: 1, jump: true });
        expect(Math.floor(body.x)).toBe(exit.x);
        expect(Math.floor(body.y)).toBe(exit.y + SOUTH_EXIT_HALL_DEPTH);
        expect(world.tileAt(Math.floor(body.x), Math.floor(body.y))).toBe(TILE.Floor);
      }
    },
  );
});
