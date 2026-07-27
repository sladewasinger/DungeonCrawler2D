import { LEVEL, STEP_UP, TICK_DT, World, cloneBody, createBody, stepBody } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PredictionCorrection } from "../../net/predictionCorrection.js";
import { projectSelfRenderPose } from "./selfInterpolation.js";

function eastWall(world: World): { x: number; y: number; z: number } {
  for (let y = -30; y <= 30; y += 1) {
    const approach = eastApproachInRow(world, y);
    if (approach) return approach;
  }
  throw new Error("seed fixture has no east-facing wall approach");
}

function eastApproachInRow(world: World, y: number): { x: number; y: number; z: number } | undefined {
  for (let x = -30; x <= 30; x += 1) {
    const approach = eastApproachAt(world, x, y);
    if (approach) return approach;
  }
  return undefined;
}

function eastApproachAt(world: World, x: number, y: number): { x: number; y: number; z: number } | undefined {
  if (!world.isWalkable(x, y) || !world.isWalkable(x + 1, y)) return undefined;
  if (world.heightAt(x + 1, y) - world.heightAt(x, y) <= STEP_UP) return undefined;
  return { x: x + 0.5, y: y + 0.5, z: world.groundAt(x + 0.5, y + 0.5) };
}

describe("projectSelfRenderPose wall projection", () => {
  it("does not project through a wall", () => {
    const world = new World(7, 0, LEVEL.Sandbox); const start = eastWall(world); const body = createBody(start.x, start.y, start.z);
    const pose = projectSelfRenderPose(world, body, { moveX: 1, moveY: 0, jump: false }, 49, { stamina: 100, maxStamina: 100, blocking: false }, false, new PredictionCorrection(), 16);
    expect(pose.x).toBeGreaterThan(start.x); expect(pose.x).toBeLessThan(start.x + 0.25); expect(pose.y).toBe(start.y); expect(body.x).toBe(start.x);
  });
  it("stays fixed throughout a blocked sprint tick", () => {
    const world = new World(7, 0, LEVEL.Sandbox); const wall = eastWall(world); const run = { moveX: 1, moveY: 0, jump: false, run: true }; const body = createBody(wall.x - 0.45, wall.y, wall.z);
    stepBody(world, body, run, TICK_DT); stepBody(world, body, run, TICK_DT); const contactX = body.x;
    for (const ms of [1, 3, 5, 20, 35, 49]) {
      const projected = cloneBody(body); stepBody(world, projected, run, ms / 1000);
      expect(projected.x).toBeCloseTo(contactX, 4); expect(projectSelfRenderPose(world, body, run, ms, { stamina: 100, maxStamina: 100, blocking: false }, false, new PredictionCorrection(), 16).x).toBeCloseTo(contactX, 4);
    }
  });
  it("discards blocked-axis reconciliation", () => {
    const world = new World(7, 0, LEVEL.Sandbox); const wall = eastWall(world); const run = { moveX: 1, moveY: 0, jump: false, run: true }; const body = createBody(wall.x - 0.45, wall.y, wall.z);
    stepBody(world, body, run, TICK_DT); stepBody(world, body, run, TICK_DT); const correction = new PredictionCorrection(); correction.record({ x: body.x + 0.6, y: body.y + 0.2, z: body.z }, body);
    const contact = projectSelfRenderPose(world, body, run, 25, { stamina: 100, maxStamina: 100, blocking: false }, false, correction, 16);
    const released = projectSelfRenderPose(world, body, { moveX: 0, moveY: 0, jump: false }, 0, { stamina: 100, maxStamina: 100, blocking: false }, false, correction, 0);
    expect(contact.x).toBe(body.x); expect(contact.y).toBeCloseTo(body.y + 0.2); expect(released.x).toBe(body.x);
  });
});
