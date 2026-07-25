import {
  LEVEL,
  MOVE_SPEED,
  World,
  cloneBody,
  createBody,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PredictionCorrection } from "../../net/predictionCorrection.js";
import { projectSelfRenderPose } from "./selfInterpolation.js";

const SPAWN_X = -6;
const SPAWN_Y = -13;

describe("projectSelfRenderPose", () => {
  it("renders into the unsimulated tick remainder instead of one tick behind", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const body = createBody(SPAWN_X, SPAWN_Y, 5);
    const before = cloneBody(body);
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
    );

    expect(pose.x).toBeCloseTo(SPAWN_X + MOVE_SPEED * 0.025);
    expect(pose.y).toBeCloseTo(SPAWN_Y);
    expect(body).toEqual(before);
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
});
