import {
  TICK_DT,
  createBody,
  stepBody,
  type GridPathStep,
  type MoveInput,
  type WorldView,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  decideRememberedRouteSteering,
  type RememberedRouteDecision,
} from "../ai/rememberedRouteSteering.js";
import {
  initializeRouteProgress,
  routeProgressAfterMotion,
} from "../ai/rememberedRouteProgress.js";

const STEPS: GridPathStep[] = [
  { x: 0.5, y: 1.5, jump: false },
  { x: 1.5, y: 1.5, jump: true },
  { x: 2.5, y: 1.5, jump: false },
  { x: 2.5, y: 0.5, jump: false },
];

const world: WorldView = {
  isWalkable: (x, y) => !(Math.floor(x) === 1 && Math.floor(y) === 0),
  heightAt: (x, y) => routeHeight(x, y),
  groundAt: (x, y) => routeHeight(x, y),
  stairHeightAt: () => null,
};

describe("remembered route steering sequence", () => {
  it("makes stable progress around a wall and up a pit rim", () => {
    const body = createBody(0.72, 0.72, -1);
    const steps = [...STEPS];
    const decisions: RememberedRouteDecision[] = [];
    for (let tick = 0; tick < 80 && steps.length > 0; tick++) {
      consumeEnteredStep(body, steps);
      const step = steps[0];
      if (!step) break;
      const decision = decideRememberedRouteSteering({
        body,
        step,
        alignmentTolerance: 0.1,
      });
      decisions.push(decision);
      stepBody(world, body, decision.move, TICK_DT, { speed: 3 });
    }
    consumeEnteredStep(body, steps);
    expect(steps).toHaveLength(0);
    expect(hasRapidAxisAlternation(decisions.map(({ move }) => move)))
      .toBe(false);
    expect(decisions
      .filter(({ state }) => state === "align")
      .every(({ move }) => !move.jump)).toBe(true);
  });

  it("counts back-and-forth motion as a stall instead of fresh progress", () => {
    const step = { x: 1.5, y: 0.5, jump: false };
    let progress = initializeRouteProgress(
      undefined,
      step,
      { x: 0.7, y: 0.5 },
    );
    for (const x of [0.6, 0.7, 0.6, 0.7]) {
      progress = routeProgressAfterMotion({
        previous: progress,
        step,
        position: { x, y: 0.5 },
        movementRequested: true,
        minimumProgress: 0.01,
      });
    }
    expect(progress.stalledTicks).toBe(4);
  });
});

function consumeEnteredStep(
  body: ReturnType<typeof createBody>,
  steps: GridPathStep[],
): void {
  const step = steps[0];
  if (!step) return;
  const entered = Math.floor(body.x) === Math.floor(step.x) &&
    Math.floor(body.y) === Math.floor(step.y);
  if (entered) steps.shift();
}

function routeHeight(x: number, y: number): number {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return tileX === 0 && tileY <= 1 ? -1 : 0;
}

function hasRapidAxisAlternation(moves: MoveInput[]): boolean {
  return moves.some((move, index) =>
    alternates(moves[index - 2]?.moveX, moves[index - 1]?.moveX, move.moveX) ||
    alternates(moves[index - 2]?.moveY, moves[index - 1]?.moveY, move.moveY)
  );
}

function alternates(
  first: number | undefined,
  second: number | undefined,
  third: number,
): boolean {
  return first !== undefined && second !== undefined &&
    first !== 0 && first === third && first === -second;
}
