import {
  MOVE_SPEED,
  TICK_DT,
  advanceContinuousMovementSpeed,
  cloneBody,
  createBody,
  initialContinuousMovementSpeedState,
  stepBody,
  type BodyState,
  type ContinuousMovementSpeedProjection,
  type ContinuousMovementSpeedState,
  type ContinuousMovementStatusSnapshot,
  type MoveInput,
  type StatusDef,
  type World,
} from "@dc2d/engine";
import { projectSelfRenderPose } from "../../../scenes/dungeon/player/selfInterpolation.js";
import { PredictionCorrection } from "../predictionCorrection.js";
import { Prediction } from "../prediction.js";
import { sandboxWorld, SPAWN_X, SPAWN_Y } from "../predictionTestSupport.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const APPLY_TICK = 3;
const SNAPSHOT_DELAY_TICKS = 2;
const TOTAL_TICKS = 14;
const DEFINITIONS = new Map<string, StatusDef>([
  movementStatus("slowed", 0.6),
  movementStatus("stacked-slow", 0.8),
  movementStatus("wet", 0.75),
]);

interface SnapshotFrame {
  readonly tick: number;
  readonly body: BodyState;
  readonly movement: ContinuousMovementSpeedProjection;
}

export interface MovementTimelineSample {
  readonly tick: number;
  readonly correction: number | null;
  readonly renderedSpeed: number;
  readonly projectedSpeed: number;
}

function movementStatus(id: string, mult: number): [string, StatusDef] {
  return [id, {
    id, name: id, kind: "debuff", tags: [], duration: 4, stacking: "stack",
    whileActive: [{ primitive: "modify_stat", stat: "speed", mult }],
  }];
}

function projection(state: ContinuousMovementSpeedState): ContinuousMovementSpeedProjection {
  return {
    currentSpeed: state.speed,
    statuses: state.statuses,
    statusDefinition: (id) => DEFINITIONS.get(id),
  };
}

function activatedMovement(
  statuses: readonly ContinuousMovementStatusSnapshot[],
): ContinuousMovementSpeedState {
  const speed = statuses.reduce((value, status) => {
    const mult = DEFINITIONS.get(status.id)?.whileActive?.[0];
    return mult?.primitive === "modify_stat"
      ? value * (mult.mult ** (status.stacks ?? 1))
      : value;
  }, MOVE_SPEED);
  return initialContinuousMovementSpeedState(projection({ speed, statuses }));
}

function advanceMovement(state: ContinuousMovementSpeedState): ContinuousMovementSpeedState {
  return advanceContinuousMovementSpeed({
    ...state,
    statusDefinition: (id) => DEFINITIONS.get(id),
    tickDuration: TICK_DT,
  });
}

function renderSpeed(prediction: Prediction, body: BodyState, world: World): number {
  const pose = projectSelfRenderPose({
    world,
    body,
    input: WALK,
    accumulatorMs: TICK_DT * 500,
    resources: { stamina: 100, maxStamina: 100, blocking: false },
    canBlock: false,
    correction: new PredictionCorrection(),
    deltaMs: 0,
    movementSpeed: prediction.currentMovementSpeed(),
  });
  return (pose.x - body.x) / (TICK_DT / 2);
}

export function runMovementModifierTimeline(
  activatedStatuses: readonly ContinuousMovementStatusSnapshot[],
): readonly MovementTimelineSample[] {
  const world = sandboxWorld();
  const prediction = new Prediction();
  const server = createBody(SPAWN_X, SPAWN_Y, 5);
  let client = cloneBody(server);
  let movement = activatedMovement([]);
  const snapshots: SnapshotFrame[] = [];
  const samples: MovementTimelineSample[] = [];
  prediction.reconcile({
    world, body: client, lastSimulatedProjectedTick: 0, authoritativeServerTick: 0,
    movementSpeedProjection: projection(movement),
  });
  for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
    prediction.predict({ world, body: client, input: WALK });
    if (tick === APPLY_TICK) movement = activatedMovement(activatedStatuses);
    stepBody(world, server, WALK, TICK_DT, { speed: movement.speed });
    movement = advanceMovement(movement);
    snapshots.push({ tick, body: cloneBody(server), movement: projection(movement) });
    const due = snapshots[tick - SNAPSHOT_DELAY_TICKS - 1];
    const correction = due
      ? reconcile({ prediction, predicted: client, snapshot: due, world })
      : null;
    if (correction) client = correction.body;
    samples.push({
      tick,
      correction: correction?.distance ?? null,
      renderedSpeed: renderSpeed(prediction, client, world),
      projectedSpeed: prediction.currentMovementSpeed(),
    });
  }
  return samples;
}

interface Reconciliation {
  readonly prediction: Prediction;
  readonly predicted: BodyState;
  readonly snapshot: SnapshotFrame;
  readonly world: World;
}

function reconcile(request: Reconciliation): {
  readonly body: BodyState;
  readonly distance: number;
} {
  const { prediction, predicted, snapshot, world } = request;
  const body = cloneBody(snapshot.body);
  prediction.reconcile({
    world, body, lastSimulatedProjectedTick: snapshot.tick,
    authoritativeServerTick: snapshot.tick,
    movementSpeedProjection: snapshot.movement,
  });
  return { body, distance: Math.abs(predicted.x - body.x) };
}
