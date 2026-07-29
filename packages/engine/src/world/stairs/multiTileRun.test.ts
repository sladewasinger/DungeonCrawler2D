import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../core/constants.js";
import { createBody, stepBody } from "../../entities/movement/index.js";
import { entryClimbDir, stairRampAt, type StairView } from "./stairs.js";
import { TILE } from "../core/types.js";

const RUN_X = 50;
const RUN_Y = 50;

function straightRun(steps: number, depth: number, width = 1): StairView {
  const inRun = (x: number): boolean => x >= RUN_X && x < RUN_X + width;
  const heightAt = (x: number, y: number): number => runHeight({ inRun, x, y, steps, depth });
  return {
    tileAt: (x, y) => inRun(x) && y >= RUN_Y && y < RUN_Y + steps ? TILE.Stairs : TILE.Floor,
    heightAt,
  };
}

function runHeight({ inRun, x, y, steps, depth }: { inRun: (x: number) => boolean; x: number; y: number; steps: number; depth: number }): number {
  if (!inRun(x)) return y < RUN_Y ? 0 : depth;
  if (y < RUN_Y) return 0;
  if (y >= RUN_Y + steps) return depth;
  return (depth * (y - RUN_Y + 1)) / (steps + 1);
}

function walkDown({ view, startX, steps, depth }: { view: StairView; startX: number; steps: number; depth: number }): void {
  const groundAt = (x: number, y: number): number => stairRampAt(view, x, y) ?? view.heightAt(Math.floor(x), Math.floor(y));
  const stairHeightAt = (x: number, y: number): number | null => view.tileAt(Math.floor(x), Math.floor(y)) === TILE.Stairs ? stairRampAt(view, x, y) : null;
  const world = { isWalkable: () => true, heightAt: view.heightAt, groundAt, stairHeightAt };
  const body = createBody(startX, RUN_Y - 2, 0);
  for (let tick = 0; tick < 150; tick++) {
    stepBody(world, body, { moveX: 0, moveY: 1, jump: false }, TICK_DT);
    expect(body.grounded, `tick ${tick} got stuck airborne`).toBe(true);
  }
  expect(body.z).toBeCloseTo(depth, 1);
  expect(body.y).toBeGreaterThan(RUN_Y + steps);
}

describe("multi-tile stair runs", () => {
  it("detects every interior climb direction", () => {
    const view = straightRun(4, -2);
    for (let step = 0; step < 4; step++) expect(entryClimbDir(view, RUN_X, RUN_Y + step)).toBe(0);
  });

  it("walks runs outside the former fixed step-size band", () => {
    for (const steps of [2, 6]) walkDown({ view: straightRun(steps, -2), startX: RUN_X + 0.5, steps, depth: -2 });
  });

  it("walks a wide run without a body-radius side clip", () => {
    walkDown({ view: straightRun(3, -2, 2), startX: RUN_X + 1, steps: 3, depth: -2 });
  });
});
