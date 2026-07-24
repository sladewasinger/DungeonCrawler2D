/** Produces the local player's render pose without mutating authoritative simulation state. */
import type { BodyState } from "@dc2d/engine";
import type { Connection } from "../../net/connection.js";
import type { PredictionCorrection } from "../../net/predictionCorrection.js";
import { interpolationAlpha, lerp } from "./fixedStep.js";
import type { DungeonSceneState, RenderPose } from "./state.js";

export function interpolateConnectionSelf(
  connection: Connection,
  state: DungeonSceneState,
  deltaMs: number,
): RenderPose {
  if (!connection.body) return { x: 0, y: 0, z: 0 };
  return interpolateSelf(
    connection.body,
    state.prevStep,
    state.accumulatorMs,
    connection.predictionCorrection,
    deltaMs,
  );
}

export function interpolateSelf(
  body: BodyState,
  previous: RenderPose | null,
  accumulatorMs: number,
  correction: PredictionCorrection,
  deltaMs: number,
): RenderPose {
  const alpha = interpolationAlpha(accumulatorMs);
  const from = previous ?? body;
  const offset = correction.advance(deltaMs);
  return {
    x: lerp(from.x, body.x, alpha) + offset.x,
    y: lerp(from.y, body.y, alpha) + offset.y,
    z: lerp(from.z, body.z, alpha) + offset.z,
  };
}
