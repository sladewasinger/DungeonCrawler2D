import { describe, expect, it } from "vitest";
import { findGridPath } from "./gridPath.js";
import type { WorldView } from "../world/core/types.js";
import { finiteWorldFixture } from "../world/core/fixtures/finiteWorldFixture.js";

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
    const world = finiteWorldFixture();
    const stair = world.generatedFloor?.downStairways[0];
    if (!stair) throw new Error("generated floor has no down stair fixture");
    const port = stair.ports[0];
    if (!port) throw new Error("generated stair has no low-end port");
    const path = findGridPath({ world, start: port, goal: stair.position });

    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toMatchObject({ x: stair.position.x + 0.5, y: stair.position.y + 0.5 });
    for (const step of path) {
      expect(world.isWalkable(Math.floor(step.x), Math.floor(step.y))).toBe(true);
    }
  });
});
