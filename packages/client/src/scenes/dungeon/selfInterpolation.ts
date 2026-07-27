/** Produces the local player's render pose without mutating authoritative simulation state. */
import {
  TICK_DT,
  cloneBody,
  stepBody,
  stepPlayerResources,
  type BodyState,
  type MoveInput,
  type PlayerResourceState,
  type World,
} from "@dc2d/engine";
import type { Connection } from "../../net/connection.js";
import type { PredictionCorrection } from "../../net/predictionCorrection.js";
import type { DungeonSceneState, RenderPose } from "./state.js";

export function interpolateConnectionSelf(
  connection: Connection,
  state: DungeonSceneState,
  deltaMs: number,
): RenderPose {
  if (!connection.body || !connection.world) return { x: 0, y: 0, z: 0 };
  return projectSelfRenderPose({
    world: connection.world,
    body: connection.body,
    input: state.renderInput,
    accumulatorMs: state.accumulatorMs,
    resources: connection,
    canBlock: connection.weapon !== null,
    correction: connection.predictionCorrection,
    deltaMs,
    canAct: connection.canAct,
  });
}

export interface SelfRenderPoseRequest {
  readonly world: World;
  readonly body: BodyState;
  readonly input: MoveInput;
  readonly accumulatorMs: number;
  readonly resources: PlayerResourceState;
  readonly canBlock: boolean;
  readonly correction: PredictionCorrection;
  readonly deltaMs: number;
  readonly canAct?: boolean;
}

type LegacySelfRenderPoseArgs = [World, BodyState, MoveInput, number, PlayerResourceState, boolean, PredictionCorrection, number, boolean?];

export function projectSelfRenderPose(...args: [SelfRenderPoseRequest] | LegacySelfRenderPoseArgs): RenderPose {
  const request = normalizeSelfRenderPoseRequest(args);
  const { world, body, input, accumulatorMs, resources, canBlock, correction, deltaMs, canAct = true } = request;
  const projected = cloneBody(body);
  const projectedResources = { ...resources };
  const blocked = projectMovement({ world, projected, projectedResources, input, canBlock, canAct });
  const offset = correction.advance(deltaMs, blocked);
  return {
    x: body.x + (projected.x - body.x) * renderAlpha(accumulatorMs) + offset.x,
    y: body.y + (projected.y - body.y) * renderAlpha(accumulatorMs) + offset.y,
    z: body.z + (projected.z - body.z) * renderAlpha(accumulatorMs) + offset.z,
  };
}

function normalizeSelfRenderPoseRequest(args: [SelfRenderPoseRequest] | LegacySelfRenderPoseArgs): SelfRenderPoseRequest {
  const [first] = args;
  if ("world" in first) return first;
  const [world, body, input, accumulatorMs, resources, canBlock, correction, deltaMs, canAct] = args as LegacySelfRenderPoseArgs;
  return { world, body, input, accumulatorMs, resources, canBlock, correction, deltaMs, ...(canAct === undefined ? {} : { canAct }) };
}

function renderAlpha(accumulatorMs: number): number {
  return Math.min(1, Math.max(0, accumulatorMs / (TICK_DT * 1000)));
}

interface ProjectMovementRequest {
  readonly world: World;
  readonly projected: BodyState;
  readonly projectedResources: PlayerResourceState;
  readonly input: MoveInput;
  readonly canBlock: boolean;
  readonly canAct: boolean;
}

function projectMovement(request: ProjectMovementRequest): { x: boolean; y: boolean } {
  if (!request.canAct) return { x: false, y: false };
  const effective = stepPlayerResources({ state: request.projectedResources, input: request.input, canBlock: request.canBlock, dt: TICK_DT }).input;
  const step = stepBody(request.world, request.projected, effective, TICK_DT);
  return { x: request.input.moveX !== 0 && step.blockedX === true, y: request.input.moveY !== 0 && step.blockedY === true };
}
