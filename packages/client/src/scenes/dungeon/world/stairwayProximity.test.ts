import { stairwayUpPosition } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { finiteTerrainWorldFixture } from "../../../testing/terrainWorldFixture.js";
import { resolveStairwayPrompt } from "./stairwayProximity.js";

describe("resolveStairwayPrompt", () => {
  it("prompts to descend when standing at floor 1's StairwayDown", () => {
    const { world, downStairway } = finiteTerrainWorldFixture();
    const prompt = resolveStairwayPrompt(world, downStairway.x, downStairway.y);
    expect(prompt).toEqual({ direction: "down", floor: 2 });
  });

  it("does not advertise the arrival stair as an ascent path", () => {
    const world = { worldSeed: 74621, floor: 2, downStairwayPositions: () => [] };
    const target = stairwayUpPosition(world);
    expect(target).not.toBeNull();
    const prompt = resolveStairwayPrompt(world, target!.x, target!.y);
    expect(prompt).toBeNull();
  });

  it("returns null far from either stairway", () => {
    const { world, downStairway } = finiteTerrainWorldFixture();
    expect(resolveStairwayPrompt(
      world,
      downStairway.x + 50,
      downStairway.y + 50,
    )).toBeNull();
  });

  it("floor 1 has no StairwayUp (nothing above it)", () => {
    const { world } = finiteTerrainWorldFixture();
    expect(stairwayUpPosition(world)).toBeNull();
  });
});
