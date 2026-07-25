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
  return projectSelfRenderPose(
    connection.world,
    connection.body,
    state.renderInput,
    state.accumulatorMs,
    connection,
    connection.weapon !== null,
    connection.predictionCorrection,
    deltaMs,
  );
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
): RenderPose {
  const projected = cloneBody(body);
  const projectedResources = { ...resources };
  const alpha = Math.min(
    1,
    Math.max(0, accumulatorMs) / (TICK_DT * 1000),
  );
  const effective = stepPlayerResources(
    projectedResources,
    input,
    canBlock,
    TICK_DT,
  ).input;
  stepBody(world, projected, effective, TICK_DT);
  const offset = correction.advance(deltaMs);
  return {
    x: body.x + (projected.x - body.x) * alpha + offset.x,
    y: body.y + (projected.y - body.y) * alpha + offset.y,
    z: body.z + (projected.z - body.z) * alpha + offset.z,
  };
}
