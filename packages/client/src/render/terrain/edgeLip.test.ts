// Headless tests for the non-wall cliff-edge shadow lip — no Phaser involved.
import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { edgeLipAngle, type TerrainSource } from "./edgeLip.js";

function terrain(heights: Record<string, number>, walls: Set<string> = new Set()): TerrainSource {
  const key = (x: number, y: number) => `${x},${y}`;
  return {
    heightAt: (x, y) => heights[key(x, y)] ?? 0,
    tileAt: (x, y) => (walls.has(key(x, y)) ? TILE.Wall : TILE.Floor),
  };
}

describe("edgeLipAngle", () => {
  it("returns null on flat ground", () => {
    expect(edgeLipAngle(terrain({}), 0, 0)).toBeNull();
  });

  it("faces the higher neighbor when a real step exists", () => {
    const world = terrain({ "0,-1": 1 });
    expect(edgeLipAngle(world, 0, 0)).toBe(180);
  });

  it("ignores a wall neighbor — wall faces own that boundary already", () => {
    const world = terrain({ "0,-1": 2 }, new Set(["0,-1"]));
    expect(edgeLipAngle(world, 0, 0)).toBeNull();
  });

  it("ignores height noise below the epsilon", () => {
    const world = terrain({ "0,-1": 0.1 });
    expect(edgeLipAngle(world, 0, 0)).toBeNull();
  });
});
