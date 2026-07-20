import { stairwayDownPosition, stairwayUpPosition, World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { resolveStairwayPrompt } from "./stairwayProximity.js";

const SEED = 1337;

describe("resolveStairwayPrompt", () => {
  it("prompts to descend when standing at floor 1's StairwayDown", () => {
    const world = new World(SEED, 1);
    const target = stairwayDownPosition(world);
    expect(target).not.toBeNull();
    const prompt = resolveStairwayPrompt(world, target!.x, target!.y);
    expect(prompt).toEqual({ direction: "down", floor: 2 });
  });

  it("prompts to ascend when standing at floor 2's StairwayUp", () => {
    const world = new World(SEED, 2);
    const target = stairwayUpPosition(world);
    expect(target).not.toBeNull();
    const prompt = resolveStairwayPrompt(world, target!.x, target!.y);
    expect(prompt).toEqual({ direction: "up", floor: 1 });
  });

  it("returns null far from either stairway", () => {
    const world = new World(SEED, 1);
    const down = stairwayDownPosition(world)!;
    expect(resolveStairwayPrompt(world, down.x + 50, down.y + 50)).toBeNull();
  });

  it("floor 1 has no StairwayUp (nothing above it)", () => {
    const world = new World(SEED, 1);
    expect(stairwayUpPosition(world)).toBeNull();
  });
});
