import type { ActiveStatus } from "../entities/entity.js";
import type { StatusDef } from "./types.js";

const STATUS_TIME_EPSILON = 1e-9;

export interface ContinuousMovementSpeedRequest {
  readonly baseSpeed: number;
  readonly statuses: readonly ActiveStatus[];
  readonly statusDefinition: (statusId: string) => StatusDef | undefined;
}

export interface ContinuousMovementStatusSnapshot {
  readonly id: string;
  readonly remainingSeconds: number | null;
  readonly stacks?: number | undefined;
}

export interface ContinuousMovementSpeedProjection {
  readonly currentSpeed: number;
  readonly statuses: readonly ContinuousMovementStatusSnapshot[];
  readonly statusDefinition: (statusId: string) => StatusDef | undefined;
}

export interface ContinuousMovementSpeedState {
  readonly speed: number;
  readonly statuses: readonly ContinuousMovementStatusSnapshot[];
}

export interface ContinuousMovementSpeedAdvanceRequest {
  readonly speed: number;
  readonly statuses: readonly ContinuousMovementStatusSnapshot[];
  readonly statusDefinition: (statusId: string) => StatusDef | undefined;
  readonly tickDuration: number;
}

export function initialContinuousMovementSpeedState(
  projection: ContinuousMovementSpeedProjection,
): ContinuousMovementSpeedState {
  return {
    speed: projection.currentSpeed,
    statuses: activeStatuses(projection.statuses),
  };
}

/** Resolves data-authored, continuously active speed modifiers into tiles per second. */
export function resolveContinuousMovementSpeed(
  request: ContinuousMovementSpeedRequest,
): number {
  const { baseSpeed, statuses, statusDefinition } = request;
  return statuses.reduce((speed, status) => (
    speed * statusSpeedMultiplier(status.stacks, statusDefinition(status.defId))
  ), baseSpeed);
}

/**
 * Advances one movement tick after its movement has already been applied.
 * This ordering mirrors the server: movement sees a status at its current
 * remaining time, then the effect timer advances and may remove it.
 */
export function advanceContinuousMovementSpeed(
  request: ContinuousMovementSpeedAdvanceRequest,
): ContinuousMovementSpeedState {
  const { speed, statuses, statusDefinition, tickDuration } = request;
  let nextSpeed = speed;
  const nextStatuses: ContinuousMovementStatusSnapshot[] = [];
  for (const status of statuses) {
    const remaining = status.remainingSeconds;
    if (remaining === null) {
      nextStatuses.push(status);
      continue;
    }
    if (remaining <= tickDuration + STATUS_TIME_EPSILON) {
      nextSpeed = removeStatusModifier(nextSpeed, status, statusDefinition);
      continue;
    }
    nextStatuses.push({
      ...status,
      remainingSeconds: remaining - tickDuration,
    });
  }
  return { speed: nextSpeed, statuses: nextStatuses };
}

/** Returns the speed used at the start of each projected movement tick. */
export function projectContinuousMovementSpeeds(
  request: ContinuousMovementSpeedProjection & {
    readonly tickCount: number;
    readonly tickDuration: number;
  },
): readonly number[] {
  let state = initialContinuousMovementSpeedState(request);
  const speeds: number[] = [];
  for (let tick = 0; tick < request.tickCount; tick++) {
    speeds.push(state.speed);
    state = advanceContinuousMovementSpeed({
      speed: state.speed,
      statuses: state.statuses,
      statusDefinition: request.statusDefinition,
      tickDuration: request.tickDuration,
    });
  }
  return speeds;
}

function activeStatuses(
  statuses: readonly ContinuousMovementStatusSnapshot[],
): ContinuousMovementStatusSnapshot[] {
  return statuses.filter((status) => (
    status.remainingSeconds === null || status.remainingSeconds > STATUS_TIME_EPSILON
  ));
}

function removeStatusModifier(
  speed: number,
  status: ContinuousMovementStatusSnapshot,
  statusDefinition: (statusId: string) => StatusDef | undefined,
): number {
  const multiplier = statusSpeedMultiplier(
    status.stacks ?? 1,
    statusDefinition(status.id),
  );
  return multiplier === 1 ? speed : speed / multiplier;
}

function statusSpeedMultiplier(
  stacks: number,
  definition: StatusDef | undefined,
): number {
  const modifiers = definition?.whileActive ?? [];
  return modifiers.reduce((multiplier, primitive) => {
    if (primitive.primitive !== "modify_stat" || primitive.stat !== "speed") {
      return multiplier;
    }
    return multiplier * (primitive.mult ** stacks);
  }, 1);
}
