/** Produces the local player's render pose without mutating authoritative simulation state. */
import {
  TICK_DT,
  stepBody,
  stepPlayerResourcesInto,
  type BodyState,
  type MoveInput,
  type PlayerResourceState,
  type World,
} from "@dc2d/engine";
import type { Connection } from "../../net/connection.js";
import type { PredictionCorrection } from "../../net/predictionCorrection.js";
import {
  createSelfProjectionScratch,
  type DungeonSceneState,
  type RenderPose,
  type SelfProjectionScratch,
} from "./state.js";

export function interpolateConnectionSelf(
  connection: Connection,
  state: DungeonSceneState,
  deltaMs: number,
): RenderPose {
  if (!connection.body || !connection.world) return { x: 0, y: 0, z: 0 };
  return projectSelfRenderPose(
    connection.world,
    connection.body,
    state.renderInput,
    state.accumulatorMs,
    connection,
    connection.weapon !== null,
    connection.predictionCorrection,
    deltaMs,
    state.selfProjection,
  );
}

function copyBody(source: BodyState, target: BodyState): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.zVel = source.zVel;
  target.grounded = source.grounded;
  target.coyoteTime = source.coyoteTime;
  target.jumpBuffer = source.jumpBuffer;
  target.jumpHeld = source.jumpHeld;
  target.fallStart = source.fallStart;
  target.kx = source.kx;
  target.ky = source.ky;
}

function copyResources(
  source: PlayerResourceState,
  target: PlayerResourceState,
): void {
  target.stamina = source.stamina;
  target.maxStamina = source.maxStamina;
  target.blocking = source.blocking;
  target.staminaRecoveryDelaySeconds =
    source.staminaRecoveryDelaySeconds ?? 0;
  target.staminaExhausted = source.staminaExhausted ?? false;
}

export function projectSelfRenderPose(
  world: World,
  body: BodyState,
  input: MoveInput,
  accumulatorMs: number,
  resources: PlayerResourceState,
  canBlock: boolean,
  correction: PredictionCorrection,
  deltaMs: number,
  scratch: SelfProjectionScratch = createSelfProjectionScratch(),
): RenderPose {
  const projected = scratch.body;
  const projectedResources = scratch.resources;
  copyBody(body, projected);
  copyResources(resources, projectedResources);
  const alpha = Math.min(
    1,
    Math.max(0, accumulatorMs) / (TICK_DT * 1000),
  );
  const effective = stepPlayerResourcesInto(
    projectedResources,
    input,
    canBlock,
    TICK_DT,
    scratch.resourceStep,
  ).input;
  const step = stepBody(world, projected, effective, TICK_DT);
  const blockedX = input.moveX !== 0 && step.blockedX === true;
  const blockedY = input.moveY !== 0 && step.blockedY === true;
  const offset = correction.advance(deltaMs, { x: blockedX, y: blockedY });
  scratch.pose.x = body.x + (projected.x - body.x) * alpha + offset.x;
  scratch.pose.y = body.y + (projected.y - body.y) * alpha + offset.y;
  scratch.pose.z = body.z + (projected.z - body.z) * alpha + offset.z;
  return scratch.pose;
}
