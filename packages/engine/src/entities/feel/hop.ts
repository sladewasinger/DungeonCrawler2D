import { TICK_DT } from "../../core/constants.js";
import { createBody, stepBody } from "../movement/index.js";
import { fixtureWorld } from "./worldFixture.js";

const MAX_TICKS = 200;
const SHORT_HOP_HOLD_TICKS = 2;

export interface HopMetrics {
  ascentTicks: number;
  descentTicks: number;
  totalTicks: number;
  apexHeight: number;
  horizontalDistance: number;
}

interface HopProgress {
  apexHeight: number;
  ascentTicks: number;
  totalTicks: number;
}

interface HopTick {
  holdJump: boolean;
  tick: number;
  progress: HopProgress;
  body: ReturnType<typeof createBody>;
}

function advanceHop({ holdJump, tick, progress, body }: HopTick): boolean {
  const result = stepBody(fixtureWorld(() => 0), body, { moveX: 1, moveY: 0, jump: holdJump || tick <= SHORT_HOP_HOLD_TICKS }, TICK_DT);
  if (body.z > progress.apexHeight) {
    progress.apexHeight = body.z;
    progress.ascentTicks = tick;
  }
  if (tick <= 1 || !result.landed) return false;
  progress.totalTicks = tick;
  return true;
}

export function measureHop(holdJump: boolean): HopMetrics {
  const body = createBody(5.5, 5.5, 0);
  const startX = body.x;
  const progress: HopProgress = { apexHeight: 0, ascentTicks: 0, totalTicks: 0 };
  for (let tick = 1; tick <= MAX_TICKS; tick++) if (advanceHop({ holdJump, tick, progress, body })) break;
  return {
    ...progress,
    descentTicks: progress.totalTicks ? progress.totalTicks - progress.ascentTicks : 0,
    horizontalDistance: body.x - startX,
  };
}
