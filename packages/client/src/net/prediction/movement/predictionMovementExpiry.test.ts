import {
  MOVE_SPEED,
  TICK_DT,
  createBody,
  stepBody,
  type ContinuousMovementSpeedProjection,
  type ContinuousMovementStatusSnapshot,
  type MoveInput,
  type StatusDef,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { Prediction } from "../prediction.js";
import {
  closeBody,
  sandboxWorld,
  SPAWN_X,
  SPAWN_Y,
} from "../predictionTestSupport.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const SLOWED_SPEED = MOVE_SPEED * 0.6;
const WET_AND_OILED_SPEED = MOVE_SPEED * 0.85 * 0.6;
const DEFINITIONS = new Map<string, StatusDef>([
  definition("slowed", 0.6),
  definition("wet", 0.85),
]);

function definition(id: string, mult: number): [string, StatusDef] {
  return [id, {
    id, name: id, kind: "debuff", tags: [], duration: 4, stacking: "refresh",
    whileActive: [{ primitive: "modify_stat", stat: "speed", mult }],
  }];
}

function status(id: string, remainingSeconds: number): ContinuousMovementStatusSnapshot {
  return { id, remainingSeconds };
}

function projection(
  currentSpeed: number,
  statuses: readonly ContinuousMovementStatusSnapshot[],
): ContinuousMovementSpeedProjection {
  return { currentSpeed, statuses, statusDefinition: (id) => DEFINITIONS.get(id) };
}

function predict(request: {
  readonly prediction: Prediction;
  readonly world: ReturnType<typeof sandboxWorld>;
  readonly body: ReturnType<typeof createBody>;
  readonly movementSpeedProjection: ContinuousMovementSpeedProjection;
}): void {
  const { prediction, world, body, movementSpeedProjection } = request;
  for (let tick = 0; tick < 3; tick++) {
    prediction.predict({ world, body, input: WALK, movementSpeedProjection });
  }
}

function moveAtSpeeds(
  world: ReturnType<typeof sandboxWorld>,
  body: ReturnType<typeof createBody>,
  speeds: readonly number[],
): void {
  for (const speed of speeds) stepBody(world, body, WALK, TICK_DT, { speed });
}

describe("movement modifier expiry prediction", () => {
  it("expires a modifier during local prediction and pending replay", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const speculative = createBody(SPAWN_X, SPAWN_Y, 5);
    predict({
      prediction,
      world,
      body: speculative,
      movementSpeedProjection: projection(SLOWED_SPEED, [status("slowed", TICK_DT * 2)]),
    });
    const localExpected = createBody(SPAWN_X, SPAWN_Y, 5);
    moveAtSpeeds(world, localExpected, [SLOWED_SPEED, SLOWED_SPEED, MOVE_SPEED]);
    expect(closeBody(speculative, localExpected)).toBe(true);

    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    stepBody(world, authoritative, WALK, TICK_DT, { speed: SLOWED_SPEED });
    const expected = { ...authoritative };
    moveAtSpeeds(world, expected, [SLOWED_SPEED, MOVE_SPEED]);
    prediction.reconcile({
      world, body: authoritative, lastSimulatedProjectedTick: 1, authoritativeServerTick: 1,
      movementSpeedProjection: projection(SLOWED_SPEED, [status("slowed", TICK_DT)]),
    });
    expect(closeBody(authoritative, expected)).toBe(true);
  });

  it("handles multiple pending modifier expiries in order", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const speculative = createBody(SPAWN_X, SPAWN_Y, 5);
    const initial = projection(WET_AND_OILED_SPEED, [
      status("slowed", TICK_DT), status("wet", TICK_DT * 2),
    ]);
    predict({ prediction, world, body: speculative, movementSpeedProjection: initial });

    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    stepBody(world, authoritative, WALK, TICK_DT, { speed: WET_AND_OILED_SPEED });
    const expected = { ...authoritative };
    moveAtSpeeds(world, expected, [MOVE_SPEED * 0.85, MOVE_SPEED]);
    prediction.reconcile({
      world, body: authoritative, lastSimulatedProjectedTick: 1, authoritativeServerTick: 1,
      movementSpeedProjection: projection(MOVE_SPEED * 0.85, [status("wet", TICK_DT)]),
    });
    expect(closeBody(authoritative, expected)).toBe(true);
  });
});
