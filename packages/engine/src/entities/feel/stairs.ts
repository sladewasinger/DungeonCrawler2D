import { MOVE_SPEED, TICK_DT } from "../../core/constants.js";
import { createBody, stepBody, type BodyState } from "../movement/index.js";
import { fixtureWorld } from "./worldFixture.js";

export interface StairContinuityMetrics {
  maxUpDz: number;
  maxDownDz: number;
  ticksUp: number;
  ticksDown: number;
}

interface StairWalk {
  body: BodyState;
  moveY: -1 | 1;
  tiles: number;
  groundAt: (x: number, y: number) => number;
}

function walkAndTrack({ body, moveY, tiles, groundAt }: StairWalk) {
  const world = fixtureWorld((x, y) => groundAt(x, Math.floor(y) + 0.5), groundAt);
  const budget = Math.ceil((tiles * 2) / (MOVE_SPEED * TICK_DT));
  let maxDz = 0;
  for (let tick = 0; tick < budget; tick++) {
    const before = body.z;
    stepBody(world, body, { moveX: 0, moveY, jump: false }, TICK_DT);
    maxDz = Math.max(maxDz, Math.abs(body.z - before));
  }
  return { maxDz, ticks: budget };
}

export function measureStairContinuity(): StairContinuityMetrics {
  const run = 4;
  const rise = 2;
  const groundAt = (_x: number, y: number): number => y >= 12 ? 0 : y < 8 ? rise : ((12 - y) / run) * rise;
  const up = walkAndTrack({ body: createBody(5.5, 12.5, 0), moveY: -1, tiles: 6, groundAt });
  const down = walkAndTrack({ body: createBody(5.5, 7.5, rise), moveY: 1, tiles: 6, groundAt });
  return { maxUpDz: up.maxDz, maxDownDz: down.maxDz, ticksUp: up.ticks, ticksDown: down.ticks };
}
