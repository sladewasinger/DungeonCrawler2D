import {
  TICK_DT,
  stepBody,
  stepPlayerResources,
  type BodyState,
  type MoveInput,
  type PlayerResourceState,
  type World,
} from "@dc2d/engine";
import { PredictionMovementSpeed } from "./movement/predictionMovementSpeed.js";

export interface ReplayPredictionStepRequest {
  readonly world: World;
  readonly body: BodyState;
  readonly input: MoveInput;
  readonly resources?: PlayerResourceState | undefined;
  readonly canBlock: boolean;
  readonly movementSpeed: number;
}

/** Applies one client-predicted movement step with the authoritative physics inputs. */
export function stepPredictedBody(
  request: ReplayPredictionStepRequest,
): ReturnType<typeof stepBody> {
  const { world, body, input, resources, canBlock, movementSpeed } = request;
  const effective = resources
    ? stepPlayerResources({ state: resources, input, canBlock, dt: TICK_DT }).input
    : input;
  return stepBody(world, body, effective, TICK_DT, { speed: movementSpeed });
}

export function replayPredictionStep(
  movement: PredictionMovementSpeed,
  request: ReplayPredictionStepRequest,
): void {
  stepPredictedBody({
    ...request,
    movementSpeed: movement.current(request.movementSpeed),
  });
  movement.advance();
}
