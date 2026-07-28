import { describe, expect, it } from "vitest";
import { findGridPath } from "./gridPath.js";
import { LEVEL } from "../world/core/level.js";
import type { WorldView } from "../world/core/types.js";
import { World } from "../world/core/world.js";

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
    const path = findGridPath({
      world: halfHeightBlockWorld(), start: { x: 0.5, y: 0.5 }, goal: { x: 1.5, y: 0.5 },
    });

    expect(path[0]).toMatchObject({ x: 1.5, y: 0.5, jump: true });
  });

  it("approaches a side-facing stair through its low end", () => {
    const world = new World(228182761, 1, LEVEL.Dungeon);
    const path = findGridPath({ world, start: { x: -11, y: 16 }, goal: { x: -11, y: 19 } });

    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toMatchObject({ x: -10.5, y: 19.5 });
    for (const step of path) {
      expect(world.isWalkable(Math.floor(step.x), Math.floor(step.y))).toBe(true);
    }
  });
});
