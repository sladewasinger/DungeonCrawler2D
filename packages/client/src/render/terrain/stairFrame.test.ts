// Headless tests for stair-tread rotation — no Phaser involved.
import { describe, expect, it } from "vitest";
import { stairAngle, type HeightSource } from "./stairFrame.js";

function heightMap(at: (wx: number, wy: number) => number): HeightSource {
  return { heightAt: at };
}

describe("stairAngle", () => {
  it("points north (0deg) when the north neighbor is highest", () => {
    const world = heightMap((_x, y) => (y === -1 ? 1 : 0));
    expect(stairAngle(world, 0, 0)).toBe(0);
  });

  it("points east (90deg) when the east neighbor is highest", () => {
    const world = heightMap((x) => (x === 1 ? 1 : 0));
    expect(stairAngle(world, 0, 0)).toBe(90);
  });

  it("points south (180deg) when the south neighbor is highest", () => {
    const world = heightMap((_x, y) => (y === 1 ? 1 : 0));
    expect(stairAngle(world, 0, 0)).toBe(180);
  });

  it("points west (270deg) when the west neighbor is highest", () => {
    const world = heightMap((x) => (x === -1 ? 1 : 0));
    expect(stairAngle(world, 0, 0)).toBe(270);
  });
});
