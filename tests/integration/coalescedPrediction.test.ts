/** Exercises full-rate client prediction against real authoritative simulation snapshots. */
import { type ClientInput, type ClientMessage, type MoveInput, type ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import { applySnapshot } from "../../packages/client/src/net/apply.js";
import { Connection } from "../../packages/client/src/net/connection.js";
import {
  applyReplicatedStep,
  applyStep,
  createPredictionContext,
  runDelayedInputMovement,
  sendInputsDirectly,
  type PredictionContext,
} from "./predictionSupport.js";

const HELD_MOVE: MoveInput = {
  moveX: 1,
  moveY: 0,
  jump: false,
  run: false,
};
const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

function expectSamePosition(connection: Connection, serverX: number, serverY: number): void {
  expect(connection.body?.x).toBeCloseTo(serverX, 10);
  expect(connection.body?.y).toBeCloseTo(serverY, 10);
}

describe("prediction integration", () => {
  it("re-anchors movement after a late-session teleport instead of unwinding to spawn", () => {
    const context = createPredictionContext({ seed: 716, name: "Teleported", clientId: "teleported-client", warmupTicks: 100 });
    applySnapshot(context.connection, {
      ...context.sim.step().get(context.playerId)!,
      events: [{ t: "teleported" }],
    });
    sendInputsDirectly(context);
    moveForTicks(context, HELD_MOVE, 10);
    context.connection.sendInputEdge(IDLE);
    moveForTicks(context, IDLE, 70);

    expect(context.serverPlayer.body.x).toBeGreaterThan(context.arena.x + 1);
    expectSamePosition(context.connection, context.serverPlayer.body.x, context.serverPlayer.body.y);
    expect(context.connection.prediction.pendingStepCount).toBeLessThanOrEqual(1);
  });

  it("keeps 1,000 held ticks aligned with monotonic full-rate input", () => {
    const context = createPredictionContext({ seed: 717, name: "Predictor", clientId: "prediction-client" });
    const sentInputs = captureSentInputs(context);
    const result = runHeldMovement(context);

    expect(sentInputs).toHaveLength(1_003);
    expectMonotonicInputs(sentInputs);
    expect(result).toEqual({ droppedSnapshot: true, deliveredSnapshots: expect.any(Number) });
    expect(result.deliveredSnapshots).toBeGreaterThanOrEqual(499);
    expect(result.deliveredSnapshots).toBeLessThan(1_000);
    expect(context.connection.networkMetrics.snapshot(performance.now()).maximumCorrectionError).toBeLessThan(1e-9);
  });

  it("settles at the authoritative endpoint after delayed walking and release", () => {
    const context = createPredictionContext({ seed: 718, name: "Delayed", clientId: "delayed-client" });
    const delayedInputs = new Map<number, ClientInput[]>();
    const delayedSnapshots = new Map<number, ServerSnapshot>();
    queueInputDelivery(context, delayedInputs);
    context.connection.sendInputEdge(HELD_MOVE);
    runDelayedInputMovement({ context, delayedInputs, delayedSnapshots, heldInput: HELD_MOVE, idleInput: IDLE });

    expect(context.serverPlayer.body.x).toBeGreaterThan(context.arena.x + 1);
    expectSamePosition(context.connection, context.serverPlayer.body.x, context.serverPlayer.body.y);
    expect(context.connection.prediction.pendingStepCount).toBeLessThanOrEqual(4);
  });
});

function moveForTicks(context: PredictionContext, input: MoveInput, count: number): void {
  context.connection.sendInputEdge(input);
  for (let tick = 0; tick < count; tick++) {
    context.connection.sampleInput(input);
    applyStep(context);
  }
}

function captureSentInputs(context: PredictionContext): ClientInput[] {
  const sentInputs: ClientInput[] = [];
  vi.spyOn(context.connection, "send").mockImplementation((message: ClientMessage) => {
    if (message.type !== "input") return;
    sentInputs.push(message);
    context.sim.handleInput(context.playerId, message);
  });
  return sentInputs;
}

function runHeldMovement(context: PredictionContext) {
  let deliveredSnapshots = 0;
  let droppedSnapshot = false;
  context.connection.sendInputEdge(HELD_MOVE);
  for (let tick = 1; tick <= 1_000; tick++) {
    const result = applyHeldMovementStep(context, deliveredSnapshots, droppedSnapshot);
    deliveredSnapshots = result.deliveredSnapshots;
    droppedSnapshot = result.droppedSnapshot;
  }
  context.connection.sendInputEdge(IDLE);
  context.connection.sampleInput(IDLE);
  applyReplicatedSnapshot(context);
  return { droppedSnapshot, deliveredSnapshots };
}

function applyHeldMovementStep(context: PredictionContext, deliveredSnapshots: number, droppedSnapshot: boolean) {
  context.connection.sampleInput(HELD_MOVE);
  const snapshot = applyReplicatedStep(context);
  if (!snapshot) return { deliveredSnapshots, droppedSnapshot };
  if (!droppedSnapshot && deliveredSnapshots === 4) return { deliveredSnapshots, droppedSnapshot: true };
  applySnapshot(context.connection, snapshot);
  expectSamePosition(context.connection, context.serverPlayer.body.x, context.serverPlayer.body.y);
  return { deliveredSnapshots: deliveredSnapshots + 1, droppedSnapshot };
}

function applyReplicatedSnapshot(context: PredictionContext): void {
  const snapshot = applyReplicatedStep(context);
  if (snapshot) applySnapshot(context.connection, snapshot);
}

function expectMonotonicInputs(inputs: ClientInput[]): void {
  expect(inputs.every((input, index) => input.seq === index + 1)).toBe(true);
  expect(inputs.every((input, index) => index === 0 || input.projectedServerTick >= (inputs[index - 1]?.projectedServerTick ?? 0))).toBe(true);
}

function queueInputDelivery(context: PredictionContext, delayedInputs: Map<number, ClientInput[]>): void {
  vi.spyOn(context.connection, "send").mockImplementation((message: ClientMessage) => {
    if (message.type !== "input") return;
    const deliveryTick = context.sim.tick + 2;
    const queued = delayedInputs.get(deliveryTick) ?? [];
    queued.push(message);
    delayedInputs.set(deliveryTick, queued);
  });
}
