import type { MoveInput } from "@dc2d/engine";

interface SearchSteeringInput {
  readonly position: { readonly x: number; readonly y: number };
  readonly target: { readonly x: number; readonly y: number };
  readonly arrivalTolerance: number;
}

/** Direct same-tile correction; route transitions supply any valid jump. */
export function enemySearchMove(input: SearchSteeringInput): MoveInput {
  const dx = input.target.x - input.position.x;
  const dy = input.target.y - input.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= input.arrivalTolerance) {
    return { moveX: 0, moveY: 0, jump: false };
  }
  return {
    moveX: dx / distance,
    moveY: dy / distance,
    jump: false,
  };
}
