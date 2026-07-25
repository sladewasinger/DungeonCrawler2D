/** Produces the local player's render pose without mutating authoritative simulation state. */
import {
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
  const dt = Math.max(0, accumulatorMs) / 1000;
  const effective = stepPlayerResources(
    projectedResources,
    input,
    canBlock,
    dt,
  ).input;
  stepBody(world, projected, effective, dt);
  const offset = correction.advance(deltaMs);
  return {
    x: projected.x + offset.x,
    y: projected.y + offset.y,
    z: projected.z + offset.z,
  };
}
