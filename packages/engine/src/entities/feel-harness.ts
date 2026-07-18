import { MOVE_SPEED, TICK_DT } from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { createBody, stepBody, type BodyState } from "./movement/index.js";

/**
 * Pure measurement helpers for jump/traversal "feel": headless arc
 * simulations over synthetic WorldView fixtures, run through the real
 * stepBody at TICK_DT. Exported for tests only — the next redesign wave
 * asserts target bands against these same measurements, this file only
 * measures and returns plain data.
 */

const MAX_TICKS = 200;

/** Flat/stepped world built from a tile-height function; groundAt defaults
 * to the tile height unless a continuous ramp function is supplied. */
export function fixtureWorld(
  heightFn: (x: number, y: number) => number,
  groundFn?: (x: number, y: number) => number,
): WorldView {
  return {
    isWalkable: () => true,
    heightAt: heightFn,
    groundAt: (x, y) => (groundFn ? groundFn(x, y) : heightFn(Math.floor(x), Math.floor(y))),
  };
}

export interface HopMetrics {
  /** Ticks from launch to apex. */
  ascentTicks: number;
  /** Ticks from apex to landing. */
  descentTicks: number;
  /** Ticks from launch to landing. */
  totalTicks: number;
  /** Peak height above the launch ground, in tiles. */
  apexHeight: number;
  /** Horizontal tiles covered by the time the body lands, at MOVE_SPEED. */
  horizontalDistance: number;
}

/** Simulate a hop on flat ground while moving on one axis. `holdJump`
 * true keeps jump held every tick (full hop); false releases it the
 * tick after takeoff (short hop). */
export function measureHop(holdJump: boolean): HopMetrics {
  const world = fixtureWorld(() => 0);
  const body = createBody(5.5, 5.5, 0);
  const startX = body.x;
  let apexHeight = 0;
  let ascentTicks = 0;
  let totalTicks = 0;
  for (let tick = 1; tick <= MAX_TICKS; tick++) {
    const jump = holdJump || tick === 1;
    const result = stepBody(world, body, { moveX: 1, moveY: 0, jump }, TICK_DT);
    if (body.z > apexHeight) {
      apexHeight = body.z;
      ascentTicks = tick;
    }
    if (tick > 1 && result.landed) {
      totalTicks = tick;
      break;
    }
  }
  const descentTicks = totalTicks > 0 ? totalTicks - ascentTicks : 0;
  return {
    ascentTicks,
    descentTicks,
    totalTicks,
    apexHeight,
    horizontalDistance: body.x - startX,
  };
}

/** Convert a cardinal direction name into a unit move vector. */
function dirVector(direction: "north" | "south" | "east" | "west"): [number, number] {
  if (direction === "north") return [0, -1];
  if (direction === "south") return [0, 1];
  return [direction === "east" ? 1 : -1, 0];
}

export interface ClimbResult {
  direction: string;
  success: boolean;
  ticksUsed: number;
  finalHeight: number;
}

/** Jump + run toward a rise, waiting until the body grounds at (or above)
 * `targetHeight` or the tick budget runs out. */
function climbToward(
  world: WorldView,
  body: BodyState,
  move: { moveX: number; moveY: number },
  targetHeight: number,
  budget: number,
): { success: boolean; ticksUsed: number } {
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  for (let i = 0; i < budget; i++) {
    stepBody(world, body, { ...move, jump: false }, TICK_DT);
    if (body.grounded && body.z >= targetHeight - 1e-6) return { success: true, ticksUsed: i + 1 };
  }
  return { success: false, ticksUsed: budget };
}

/** Standing one tile from a +2 ledge, attempt to clear it. */
export function measureLedgeClimb(direction: "north" | "south" | "east" | "west"): ClimbResult {
  const [dx, dy] = dirVector(direction);
  const progress = (x: number, y: number): number => (dx !== 0 ? x * dx : y * dy);
  const world = fixtureWorld((x, y) => (progress(x, y) >= 8 ? 2 : 0));
  const body = createBody(dx * 7.2 || 5.5, dy * 7.2 || 5.5, 0);
  const { success, ticksUsed } = climbToward(world, body, { moveX: dx, moveY: dy }, 2, 30);
  return { direction, success, ticksUsed, finalHeight: body.z };
}

/** Chain h0 -> h2 -> h4 -> h6 platforms spaced two tiles apart. */
export function measureChainedPlatforms(direction: "north" | "south" | "east" | "west"): ClimbResult {
  const [dx, dy] = dirVector(direction);
  const progress = (x: number, y: number): number => (dx !== 0 ? x * dx : y * dy);
  const heightFn = (x: number, y: number): number => {
    const p = progress(x, y);
    return p >= 12 ? 6 : p >= 10 ? 4 : p >= 8 ? 2 : 0;
  };
  const world = fixtureWorld(heightFn);
  const body = createBody(dx * 7.2 || 5.5, dy * 7.2 || 5.5, 0);
  const move = { moveX: dx, moveY: dy };
  let ticksUsed = 0;
  for (const target of [2, 4, 6]) {
    const step = climbToward(world, body, move, target, 30);
    ticksUsed += step.ticksUsed;
    if (!step.success) return { direction, success: false, ticksUsed, finalHeight: body.z };
  }
  return { direction, success: true, ticksUsed, finalHeight: body.z };
}

export interface StairContinuityMetrics {
  /** Largest single-tick |dz| while climbing, via groundAt. */
  maxUpDz: number;
  /** Largest single-tick |dz| while descending, via groundAt. */
  maxDownDz: number;
  ticksUp: number;
  ticksDown: number;
}

/** A 4-tile ramp rising 2 tiles total, walked up then back down; measures
 * per-tick continuity (no discontinuous jumps in z along the ramp). */
export function measureStairContinuity(): StairContinuityMetrics {
  const RUN = 4;
  const RISE = 2;
  const groundFn = (_x: number, y: number): number => {
    if (y >= 12) return 0;
    if (y < 8) return RISE;
    return ((12 - y) / RUN) * RISE;
  };
  const world = fixtureWorld((x, y) => groundFn(x, Math.floor(y) + 0.5), groundFn);

  const up = createBody(5.5, 12.5, 0);
  const upTicks = walkAndTrack(world, up, { moveX: 0, moveY: -1 }, 6);
  const down = createBody(5.5, 7.5, RISE);
  const downTicks = walkAndTrack(world, down, { moveX: 0, moveY: 1 }, 6);

  return {
    maxUpDz: upTicks.maxDz,
    maxDownDz: downTicks.maxDz,
    ticksUp: upTicks.ticks,
    ticksDown: downTicks.ticks,
  };
}

/** Step a body along one axis for `tiles` worth of travel, tracking the
 * largest per-tick |dz|. */
function walkAndTrack(
  world: WorldView,
  body: BodyState,
  move: { moveX: number; moveY: number },
  tiles: number,
): { maxDz: number; ticks: number } {
  const budget = Math.ceil((tiles * 2) / (MOVE_SPEED * TICK_DT));
  let maxDz = 0;
  let ticks = 0;
  for (let i = 0; i < budget; i++) {
    const prevZ = body.z;
    stepBody(world, body, { ...move, jump: false }, TICK_DT);
    maxDz = Math.max(maxDz, Math.abs(body.z - prevZ));
    ticks++;
  }
  return { maxDz, ticks };
}
