import {
  TICK_DT,
  clampFiniteFloorPosition,
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
  readonly noclip?: boolean | undefined;
}

/** Applies one client-predicted movement step with the authoritative physics inputs. */
export function stepPredictedBody(
  request: ReplayPredictionStepRequest,
): ReturnType<typeof stepBody> {
  const { world, body, input, resources, canBlock, movementSpeed, noclip } = request;
  const effective = resources
    ? stepPlayerResources({ state: resources, input, canBlock, dt: TICK_DT }).input
    : input;
  const result = stepBody(world, body, effective, TICK_DT, movementStepOptions(movementSpeed, noclip));
  if (noclip) clampPredictedPosition(world, body);
  return result;
}

function movementStepOptions(speed: number, noclip: boolean | undefined): { speed: number; noclip?: boolean } {
  return noclip === undefined ? { speed } : { speed, noclip };
}

function clampPredictedPosition(world: World, body: BodyState): void {
  const position = clampFiniteFloorPosition(world.floorBounds, body);
  body.x = position.x;
  body.y = position.y;
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
