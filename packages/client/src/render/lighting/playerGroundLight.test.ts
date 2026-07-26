import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  PLAYER_GROUND_LIGHT_MAX_CELLS,
  PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS,
  playerGroundLightEnabledForProfile,
  playerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightUpdate,
  type PlayerGroundLightWorld,
} from "./playerGroundLight.js";

function world(
  walls: ReadonlySet<string> = new Set(),
  chasms: ReadonlySet<string> = new Set(),
): PlayerGroundLightWorld {
  return {
    tileAt: (x, y): TileType => walls.has(`${x},${y}`) ? TILE.Wall : TILE.Floor,
    heightAt: (x, y) => chasms.has(`${x},${y}`) ? -2 : 0,
    groundAt: (x, y) => Math.floor(x) + Math.floor(y) / 10,
  };
}

function update(tileX: number, tileY: number, atMs: number, orientation: 0 | 90 | 180 | 270 = 0): PlayerGroundLightUpdate {
  return { tileX, tileY, atMs, orientation };
}

describe("playerGroundLightCells", () => {
  it("uses a fixed radius with monotonic falloff and a hard object cap", () => {
    const cells = playerGroundLightCells(world(), 0.5, 0.5);
    expect(cells).toHaveLength(PLAYER_GROUND_LIGHT_MAX_CELLS);
    expect(cells[0]).toMatchObject({ tileX: 0, tileY: 0, strength: 1 });
    expect(cells.find((cell) => cell.tileX === 1 && cell.tileY === 0)?.strength).toBeCloseTo(2 / 3);
    expect(cells.find((cell) => cell.tileX === 2 && cell.tileY === 0)?.strength).toBeCloseTo(1 / 3);
    expect(cells.every((cell) => Math.abs(cell.tileX) + Math.abs(cell.tileY) <= 2)).toBe(true);
  });

  it("does not cross a wall or include chasm cells", () => {
    const cells = playerGroundLightCells(world(new Set(["1,0"]), new Set(["0,1"])), 0.5, 0.5);
    const keys = new Set(cells.map((cell) => `${cell.tileX},${cell.tileY}`));
    expect(keys.has("1,0")).toBe(false);
    expect(keys.has("2,0")).toBe(false);
    expect(keys.has("0,1")).toBe(false);
    expect(keys.has("0,2")).toBe(false);
  });

  it("records each tile's ground height for projected floor placement", () => {
    const cells = playerGroundLightCells(world(), 2.5, 3.5);
    expect(cells[0]?.groundHeight).toBe(2.3);
  });
});

describe("shouldUpdatePlayerGroundLight", () => {
  it("throttles same-tile motion but refreshes immediately on tile crossing or rotation", () => {
    const previous = update(4, 5, 100);
    expect(shouldUpdatePlayerGroundLight(previous, update(4, 5, 199))).toBe(false);
    expect(shouldUpdatePlayerGroundLight(previous, update(4, 5, 100 + PLAYER_GROUND_LIGHT_UPDATE_INTERVAL_MS))).toBe(true);
    expect(shouldUpdatePlayerGroundLight(previous, update(5, 5, 101))).toBe(true);
    expect(shouldUpdatePlayerGroundLight(previous, update(4, 5, 101, 90))).toBe(true);
  });

  it("falls back to the existing personal halo on constrained devices", () => {
    expect(playerGroundLightEnabledForProfile("desktop")).toBe(true);
    expect(playerGroundLightEnabledForProfile("constrained")).toBe(false);
  });
});
