import type { BodyState, GridPathStep, MoveInput } from "@dc2d/engine";

export interface RememberedRouteDecision {
  readonly state: "align" | "advance" | "invalid";
  readonly move: MoveInput;
}

interface RememberedRouteInput {
  readonly body: BodyState;
  readonly step: GridPathStep;
  readonly alignmentTolerance: number;
}

export function decideRememberedRouteSteering(
  input: RememberedRouteInput,
): RememberedRouteDecision {
  const tileDelta = routeTileDelta(input.body, input.step);
  if (Math.abs(tileDelta.x) + Math.abs(tileDelta.y) !== 1) {
    return { state: "invalid", move: idleMove() };
  }
  return tileDelta.x !== 0
    ? horizontalTransition(input, tileDelta.x)
    : verticalTransition(input, tileDelta.y);
}

function horizontalTransition(
  input: RememberedRouteInput,
  direction: number,
): RememberedRouteDecision {
  const alignment = routeAxis(
    input.step.y - input.body.y,
    input.alignmentTolerance,
  );
  if (alignment !== 0) {
    return {
      state: "align",
      move: { moveX: 0, moveY: alignment, jump: false },
    };
  }
  return advanceMove(input, direction, 0);
}

function verticalTransition(
  input: RememberedRouteInput,
  direction: number,
): RememberedRouteDecision {
  const alignment = routeAxis(
    input.step.x - input.body.x,
    input.alignmentTolerance,
  );
  if (alignment !== 0) {
    return {
      state: "align",
      move: { moveX: alignment, moveY: 0, jump: false },
    };
  }
  return advanceMove(input, 0, direction);
}

function advanceMove(
  input: RememberedRouteInput,
  moveX: number,
  moveY: number,
): RememberedRouteDecision {
  return {
    state: "advance",
    move: {
      moveX,
      moveY,
      jump: input.step.jump && input.body.grounded,
    },
  };
}

function routeTileDelta(
  body: BodyState,
  step: GridPathStep,
): { x: number; y: number } {
  return {
    x: Math.floor(step.x) - Math.floor(body.x),
    y: Math.floor(step.y) - Math.floor(body.y),
  };
}

function routeAxis(delta: number, tolerance: number): number {
  return Math.abs(delta) <= tolerance ? 0 : Math.sign(delta);
}

function idleMove(): MoveInput {
  return { moveX: 0, moveY: 0, jump: false };
}
