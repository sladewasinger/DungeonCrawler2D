import type { Entity } from "@dc2d/engine";
import type {
  EnemyObservedTarget,
  EnemySlot,
} from "../../../state/enemyState.js";

export interface EnemySearchDirection {
  readonly x: number;
  readonly y: number;
}

interface ObservedTargetInput {
  readonly previous: EnemyObservedTarget | undefined;
  readonly target: Entity;
  readonly minimumMovementTiles: number;
}

/** Records the latest visible displacement, retaining direction while a target pauses. */
export function recordEnemySearchObservation(
  enemy: EnemySlot,
  target: Entity,
  minimumMovementTiles: number,
): void {
  enemy.lastObservedTarget = nextObservedTarget({
    previous: enemy.lastObservedTarget,
    target,
    minimumMovementTiles,
  });
}

export function nextObservedTarget(
  input: ObservedTargetInput,
): EnemyObservedTarget {
  const { previous, target, minimumMovementTiles } = input;
  const { x: movementX, y: movementY } = observedMovement(
    previous,
    target,
    minimumMovementTiles,
  );
  return {
    targetId: target.id,
    x: target.body.x,
    y: target.body.y,
    movementX,
    movementY,
  };
}

export function rememberedSearchDirection(
  observation: EnemyObservedTarget | undefined,
  targetId: string,
): EnemySearchDirection | undefined {
  if (!observation || observation.targetId !== targetId) return undefined;
  const magnitude = Math.hypot(observation.movementX, observation.movementY);
  if (magnitude === 0) return undefined;
  return {
    x: observation.movementX / magnitude,
    y: observation.movementY / magnitude,
  };
}

function observedMovement(
  previous: EnemyObservedTarget | undefined,
  target: Entity,
  minimumMovementTiles: number,
): EnemySearchDirection {
  if (!previous || previous.targetId !== target.id) return { x: 0, y: 0 };
  const x = target.body.x - previous.x;
  const y = target.body.y - previous.y;
  if (Math.hypot(x, y) >= minimumMovementTiles) return { x, y };
  return { x: previous.movementX, y: previous.movementY };
}
