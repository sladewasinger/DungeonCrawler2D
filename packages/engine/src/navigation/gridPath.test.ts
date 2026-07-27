import { describe, expect, it } from "vitest";
import { findGridPath } from "./gridPath.js";
import { LEVEL } from "../world/level.js";
import type { WorldView } from "../world/types.js";
import { World } from "../world/world.js";

function halfHeightBlockWorld(): WorldView {
  const groundAt = (x: number): number => x >= 1 ? 0.5 : 0;
  return {
    isWalkable: () => true,
    heightAt: (x: number) => x >= 1 ? 0.5 : 0,
    groundAt,
    stairHeightAt: () => null,
  };
}

describe("grid path elevation transitions", () => {
  it("marks an exact half-height block as a jump edge", () => {
    const path = findGridPath(
      halfHeightBlockWorld(),
      { x: 0.5, y: 0.5 },
      { x: 1.5, y: 0.5 },
    );

    expect(path[0]).toMatchObject({ x: 1.5, y: 0.5, jump: true });
  });

  it("approaches a side-facing stair through its low end", () => {
    const world = new World(228182761, 1, LEVEL.Dungeon);
    const path = findGridPath(world, { x: -21, y: 33 }, { x: -21, y: 38 });

    expect(path.slice(0, 3)).toEqual([
      { x: -21.5, y: 33.5, jump: false },
      { x: -21.5, y: 32.5, jump: false },
      { x: -22.5, y: 32.5, jump: false },
    ]);
  });
});
