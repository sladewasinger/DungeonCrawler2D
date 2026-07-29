import type { GridPathStep } from "@dc2d/engine";
import type { EnemyRouteProgress } from "../../state/enemyState.js";

interface RouteProgressInput {
  readonly previous: EnemyRouteProgress | undefined;
  readonly step: GridPathStep;
  readonly position: { readonly x: number; readonly y: number };
  readonly movementRequested: boolean;
  readonly minimumProgress: number;
}

export function initializeRouteProgress(
  previous: EnemyRouteProgress | undefined,
  step: GridPathStep,
  position: { readonly x: number; readonly y: number },
): EnemyRouteProgress {
  if (matchesStep(previous, step)) return previous;
  return {
    stepX: step.x,
    stepY: step.y,
    bestDistance: distanceToStep(position, step),
    stalledTicks: 0,
  };
}

export function routeProgressAfterMotion(
  input: RouteProgressInput,
): EnemyRouteProgress {
  const current = initializeRouteProgress(
    input.previous,
    input.step,
    input.position,
  );
  if (!input.movementRequested) return current;
  const distance = distanceToStep(input.position, input.step);
  if (distance < current.bestDistance - input.minimumProgress) {
    return { ...current, bestDistance: distance, stalledTicks: 0 };
  }
  return { ...current, stalledTicks: current.stalledTicks + 1 };
}

function matchesStep(
  progress: EnemyRouteProgress | undefined,
  step: GridPathStep,
): progress is EnemyRouteProgress {
  return progress !== undefined &&
    progress.stepX === step.x &&
    progress.stepY === step.y;
}

function distanceToStep(
  position: { readonly x: number; readonly y: number },
  step: GridPathStep,
): number {
  return Math.hypot(step.x - position.x, step.y - position.y);
}
