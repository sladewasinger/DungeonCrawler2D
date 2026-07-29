import {
  CHUNK_SIZE,
  ROOM_WALL_RISE,
  SPAWN_ROOM_H,
  TERRAIN,
  World,
  hashString,
  spawnRoomChunk,
  spawnRoomFeatures,
  spawnRoomSpawn,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  PLAYER_GROUND_LIGHT_FADE_MS,
  PLAYER_GROUND_LIGHT_MAX_CELLS,
  PLAYER_GROUND_LIGHT_RADIUS,
  PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS,
  playerGroundLightFadeAlpha,
  playerGroundLightCells,
  playerGroundLightStrength,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightUpdate,
  type PlayerGroundLightWorld,
} from "./playerGroundLight.js";

function world(
  walls: ReadonlySet<string> = new Set(),
  chasms: ReadonlySet<string> = new Set(),
  heights: ReadonlyMap<string, number> = new Map(),
): PlayerGroundLightWorld {
  return {
    terrainAt: (x, y) =>
      walls.has(`${x},${y}`) || chasms.has(`${x},${y}`)
        ? TERRAIN.Void
        : TERRAIN.Floor,
    groundAt: (x, y) =>
      heights.get(`${Math.floor(x)},${Math.floor(y)}`) ??
      (Math.floor(x) + Math.floor(y)) / 10,
  };
}

function update(input: Omit<PlayerGroundLightUpdate, "orientation"> & { orientation?: 0 | 90 | 180 | 270 }): PlayerGroundLightUpdate {
  return { ...input, orientation: input.orientation ?? 0 };
}

describe("playerGroundLightCells", () => {
  it("covers a circular radius with monotonic S-curve falloff", () => {
    const cells = playerGroundLightCells(world(), { x: 0.5, y: 0.5 });
    expect(cells.length).toBeLessThanOrEqual(PLAYER_GROUND_LIGHT_MAX_CELLS);
    expect(cells[0]).toMatchObject({ tileX: 0, tileY: 0, strength: 1 });
    expect(cells.find((cell) => cell.tileX === PLAYER_GROUND_LIGHT_RADIUS && cell.tileY === 0)?.strength).toBe(0);
    expect(cells.every((cell) =>
      Math.hypot(cell.tileX, cell.tileY) <= PLAYER_GROUND_LIGHT_RADIUS + 1e-6
    )).toBe(true);
    expect(cells.some((cell) => cell.tileX === 8 && cell.tileY === 8)).toBe(true);
  });

  it("assigns one S-curve brightness value to every tile at its Euclidean distance", () => {
    const cells = playerGroundLightCells(world(), { x: 0.5, y: 0.5 });
    for (const cell of cells) {
      const distance = Math.hypot(cell.tileX, cell.tileY);
      expect(cell.strength).toBe(playerGroundLightStrength(distance));
    }
    expect(playerGroundLightStrength(PLAYER_GROUND_LIGHT_RADIUS - 5)).toBe(1);
    expect(playerGroundLightStrength(PLAYER_GROUND_LIGHT_RADIUS - 1)).toBeLessThan(0.2);
  });

  it("does not cross a wall or include chasm cells", () => {
    const walls = new Set(
      Array.from({ length: 9 }, (_, index) => `1,${index - 4}`),
    );
    const chasms = new Set(
      Array.from({ length: 9 }, (_, index) => `${index - 4},1`),
    );
    const cells = playerGroundLightCells(world(walls, chasms), { x: 0.5, y: 0.5 });
    const keys = new Set(cells.map((cell) => `${cell.tileX},${cell.tileY}`));
    expect(keys.has("1,0")).toBe(false);
    expect(keys.has("2,0")).toBe(false);
    expect(keys.has("0,1")).toBe(false);
    expect(keys.has("0,2")).toBe(false);
  });

  it("records each tile's ground height for projected floor placement", () => {
    const cells = playerGroundLightCells(world(), { x: 2.5, y: 3.5 });
    expect(cells[0]?.groundHeight).toBe(0.5);
  });

  it("does not illuminate or cross a raised wall surface", () => {
    const wallHeights = new Map([
      ["1,-1", 3],
      ["1,0", 3],
      ["1,1", 3],
    ]);
    const cells = playerGroundLightCells(
      world(new Set(), new Set(), wallHeights),
      { x: 0.5, y: 0.5 },
    );
    const keys = new Set(cells.map((cell) => `${cell.tileX},${cell.tileY}`));

    expect(keys.has("1,0")).toBe(false);
    expect(keys.has("2,0")).toBe(false);
  });

  it("lights the spawn exit hall without lighting the hidden wall cap", () => {
    const roomWorld = new World(hashString("ground-light-room"), 1);
    const spawn = spawnRoomSpawn(10);
    const cells = playerGroundLightCells(roomWorld, spawn);
    const keys = new Set(cells.map((cell) => `${cell.tileX},${cell.tileY}`));
    const exit = spawnRoomFeatures().exit;
    const chunk = spawnRoomChunk();
    const wallY = chunk.cy * CHUNK_SIZE +
      Math.floor(CHUNK_SIZE / 2 - SPAWN_ROOM_H / 2);
    const centerX = chunk.cx * CHUNK_SIZE + CHUNK_SIZE / 2;

    expect(keys.has(`${exit.x},${exit.y - 1}`)).toBe(true);
    expect(keys.has(`${exit.x},${exit.y - 2}`)).toBe(true);
    expect(keys.has(`${centerX},${wallY}`)).toBe(false);
    expect(cells.some(({ groundHeight }) =>
      groundHeight >= ROOM_WALL_RISE)).toBe(false);
  });

  it("lights floor cells independently of any door or furniture overlay", () => {
    const overlayWorld = {
      ...world(),
      featureAt: () => 8,
    };
    const cells = playerGroundLightCells(overlayWorld, { x: 0.5, y: 0.5 });

    expect(cells[0]).toMatchObject({ tileX: 0, tileY: 0, strength: 1 });
    expect(cells.some(({ tileX }) => tileX > 0)).toBe(true);
  });
});

describe("playerGroundLightFadeAlpha", () => {
  it("smoothly fades both entering and leaving tiles without overshoot", () => {
    const halfway = PLAYER_GROUND_LIGHT_FADE_MS / 2;
    expect(playerGroundLightFadeAlpha(0, 0.2, 0)).toBe(0);
    expect(playerGroundLightFadeAlpha(0, 0.2, halfway)).toBeCloseTo(0.1);
    expect(playerGroundLightFadeAlpha(0, 0.2, PLAYER_GROUND_LIGHT_FADE_MS)).toBe(0.2);
    expect(playerGroundLightFadeAlpha(0.2, 0, halfway)).toBeCloseTo(0.1);
    expect(playerGroundLightFadeAlpha(0.2, 0, PLAYER_GROUND_LIGHT_FADE_MS * 2)).toBe(0);
  });
});

describe("shouldUpdatePlayerGroundLight", () => {
  it("throttles same-tile motion but refreshes immediately on tile crossing or rotation", () => {
    const previous = update({ tileX: 4, tileY: 5, atMs: 100 });
    expect(shouldUpdatePlayerGroundLight(previous, update({ tileX: 4, tileY: 5, atMs: 199 }))).toBe(false);
    expect(shouldUpdatePlayerGroundLight(previous, update({ tileX: 4, tileY: 5, atMs: 100 + PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS }))).toBe(true);
    expect(shouldUpdatePlayerGroundLight(previous, update({ tileX: 5, tileY: 5, atMs: 101 }))).toBe(true);
    expect(shouldUpdatePlayerGroundLight(previous, update({ tileX: 4, tileY: 5, atMs: 101, orientation: 90 }))).toBe(true);
  });

});
