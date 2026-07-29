import { describe, expect, it } from "vitest";
import type { WorldView } from "../core/types.js";
import { hasTerrainLineOfSight } from "./terrainLineOfSight.js";

function worldWith(
  heights: ReadonlyMap<string, number>,
  blocked = new Set<string>(),
): WorldView {
  const heightAt = (x: number, y: number) =>
    heights.get(`${Math.floor(x)},${Math.floor(y)}`) ?? 0;
  return {
    isWalkable: (x, y) => !blocked.has(`${Math.floor(x)},${Math.floor(y)}`),
    heightAt,
    groundAt: heightAt,
    stairHeightAt: () => null,
  };
}

function canSee(
  world: WorldView,
  from: { x: number; y: number },
  to: { x: number; y: number },
): boolean {
  return hasTerrainLineOfSight({
    world,
    from,
    to,
    maximumHeightDifference: 1,
  });
}

describe("terrain line of sight", () => {
  it("sees directly between floors one level apart", () => {
    const world = worldWith(new Map([["2,0", 1]]));
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }))
      .toBe(true);
  });

  it("cannot see over a raised platform and back down", () => {
    const world = worldWith(new Map([["1,0", 1]]));
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }))
      .toBe(false);
  });

  it("cannot look downhill over a separated ridge at the source height", () => {
    const world = worldWith(new Map([
      ["0,0", 1],
      ["2,0", 1],
    ]));
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 }))
      .toBe(false);
  });

  it("cannot look uphill through a separated ridge at the target height", () => {
    const world = worldWith(new Map([
      ["1,0", 1],
      ["3,0", 1],
    ]));
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 }))
      .toBe(false);
  });

  it("cannot see through walls or diagonally around their corners", () => {
    const blocked = new Set(["1,0"]);
    const world = worldWith(new Map(), blocked);
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }))
      .toBe(false);
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }))
      .toBe(false);
  });

  it("rejects targets more than one level away", () => {
    const world = worldWith(new Map([["1,0", 2]]));
    expect(canSee(world, { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }))
      .toBe(false);
  });
});
