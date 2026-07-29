import type { WorldView } from "../../world/core/types.js";

/** Flat/stepped world built from a tile-height function for movement feel tests. */
export function fixtureWorld(
  heightFn: (x: number, y: number) => number,
  groundFn?: (x: number, y: number) => number,
): WorldView {
  return {
    isWalkable: () => true,
    heightAt: heightFn,
    groundAt: (x, y) => groundFn ? groundFn(x, y) : heightFn(Math.floor(x), Math.floor(y)),
    stairHeightAt: () => null,
  };
}

export type CardinalDirection = "north" | "south" | "east" | "west";

export function dirVector(direction: CardinalDirection): [number, number] {
  if (direction === "north") return [0, -1];
  if (direction === "south") return [0, 1];
  return [direction === "east" ? 1 : -1, 0];
}
