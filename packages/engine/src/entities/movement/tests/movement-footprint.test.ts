import { describe, expect, it } from "vitest";
import { canOccupyBodyAt, createBody } from "../../../index.js";
import type { WorldView } from "../../../world/core/types.js";

const CORNER_WALL = { x: 4, y: 4 };

const WORLD: WorldView = {
  isWalkable: (x, y) => Math.floor(x) !== CORNER_WALL.x || Math.floor(y) !== CORNER_WALL.y,
  heightAt: () => 0,
  groundAt: () => 0,
  stairHeightAt: () => null,
};

describe("movement body footprint queries", () => {
  it("rejects an open center whose corner overlaps a wall tile", () => {
    const body = createBody(3.5, 3.5, 0);

    expect(canOccupyBodyAt({
      world: WORLD,
      body,
      x: 3.75,
      y: 3.75,
    })).toBe(false);
  });

  it("accepts a final point when all four body corners remain open", () => {
    const body = createBody(3.5, 3.5, 0);

    expect(canOccupyBodyAt({
      world: WORLD,
      body,
      x: 3.75,
      y: 3.25,
    })).toBe(true);
  });
});
