import {
  LEVEL,
  MOVE_SPEED,
  TICK_DT,
  World,
  cloneBody,
  createBody,
  stepBody,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PredictionCorrection } from "../../net/predictionCorrection.js";
import { projectSelfRenderPose } from "./selfInterpolation.js";

const SPAWN_X = -6;
const SPAWN_Y = -13;

function findEastWallApproach(world: World): { x: number; y: number; z: number } {
  for (let tileY = -30; tileY <= 30; tileY++) {
    for (let tileX = -30; tileX <= 30; tileX++) {
      if (!world.isWalkable(tileX, tileY) || world.isWalkable(tileX + 1, tileY)) continue;
      const x = tileX + 0.5;
      const y = tileY + 0.5;
      return { x, y, z: world.groundAt(x, y) };
    }
  }
  throw new Error("seed fixture has no east-facing wall approach");
}

describe("projectSelfRenderPose", () => {
  it("interpolates between the last two simulated poses", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const body = createBody(SPAWN_X, SPAWN_Y, 5);
    const previous = cloneBody(body);
    stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    const beforeProjection = cloneBody(body);
    const resources = { stamina: 100, maxStamina: 100, blocking: false };

    const pose = projectSelfRenderPose(
      world,
      body,
      { moveX: 1, moveY: 0, jump: false },
      25,
      resources,
      false,
      new PredictionCorrection(),
      16,
      previous,
    );

    expect(pose.x).toBeCloseTo(SPAWN_X + MOVE_SPEED * 0.025);
    expect(pose.y).toBeCloseTo(SPAWN_Y);
    expect(body).toEqual(beforeProjection);
    expect(resources).toEqual({ stamina: 100, maxStamina: 100, blocking: false });
  });

  it("keeps reconciliation smoothing render-only while projecting", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const body = createBody(SPAWN_X, SPAWN_Y, 5);
    const correction = new PredictionCorrection();
    correction.record(
      { x: body.x + 0.25, y: body.y, z: body.z },
      body,
    );

    const pose = projectSelfRenderPose(
      world,
      body,
      { moveX: 0, moveY: 0, jump: false },
      0,
      { stamina: 100, maxStamina: 100, blocking: false },
      false,
      correction,
      16,
    );

    expect(pose.x).toBeCloseTo(body.x + 0.25);
    expect(body.x).toBe(SPAWN_X);
  });

  it("does not visually project the player through a wall during a partial tick", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const start = findEastWallApproach(world);
    const body = createBody(start.x, start.y, start.z);
    const previous = cloneBody(body);
    stepBody(
      world,
      body,
      { moveX: 1, moveY: 0, jump: false },
      TICK_DT,
    );
    const beforeProjection = cloneBody(body);

    const pose = projectSelfRenderPose(
      world,
      body,
      { moveX: 1, moveY: 0, jump: false },
      49,
      { stamina: 100, maxStamina: 100, blocking: false },
      false,
      new PredictionCorrection(),
      16,
      previous,
    );

    expect(pose.x).toBeGreaterThan(start.x);
    expect(pose.x).toBeLessThan(start.x + 0.25);
    expect(pose.y).toBe(start.y);
    expect(body).toEqual(beforeProjection);
  });

  it("stays fixed throughout a blocked sprint tick instead of advancing then snapping back", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const wall = findEastWallApproach(world);
    const run = { moveX: 1, moveY: 0, jump: false, run: true };
    const body = createBody(wall.x - 0.45, wall.y, wall.z);
    stepBody(world, body, run, TICK_DT);
    stepBody(world, body, run, TICK_DT);
    const contactX = body.x;
    const accumulatorSamples = [1, 3, 5, 20, 35, 49];
    const legacyVariableStepXs = accumulatorSamples.map((accumulatorMs) => {
      const projected = cloneBody(body);
      stepBody(world, projected, run, accumulatorMs / 1000);
      return projected.x;
    });

    const poses = accumulatorSamples.map((accumulatorMs) =>
      projectSelfRenderPose(
        world,
        body,
        run,
        accumulatorMs,
        { stamina: 100, maxStamina: 100, blocking: false },
        false,
        new PredictionCorrection(),
        16,
      ));

    expect(contactX).toBeGreaterThan(wall.x - 0.45);
    for (const x of legacyVariableStepXs) expect(x).toBeCloseTo(contactX, 4);
    for (const pose of poses) expect(pose.x).toBeCloseTo(contactX, 4);
  });

  it("discards queued reconciliation motion on the wall-blocked sprint axis", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const wall = findEastWallApproach(world);
    const run = { moveX: 1, moveY: 0, jump: false, run: true };
    const body = createBody(wall.x - 0.45, wall.y, wall.z);
    stepBody(world, body, run, TICK_DT);
    stepBody(world, body, run, TICK_DT);
    const correction = new PredictionCorrection();
    correction.record(
      { x: body.x + 0.6, y: body.y + 0.2, z: body.z },
      body,
    );

    const contactPose = projectSelfRenderPose(
      world,
      body,
      run,
      25,
      { stamina: 100, maxStamina: 100, blocking: false },
      false,
      correction,
      16,
    );
    const releasedPose = projectSelfRenderPose(
      world,
      body,
      { moveX: 0, moveY: 0, jump: false },
      0,
      { stamina: 100, maxStamina: 100, blocking: false },
      false,
      correction,
      0,
    );

    expect(contactPose.x).toBe(body.x);
    expect(contactPose.y).toBeCloseTo(body.y + 0.2);
    expect(releasedPose.x).toBe(body.x);
  });
});
