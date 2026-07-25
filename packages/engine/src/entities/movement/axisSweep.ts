import { AIRBORNE_LEDGE_CLEARANCE, STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import {
  BODY_RADIUS,
  type BodyState,
  type StepOpts,
} from "./state.js";
import { stairGateBlocks } from "./stairGate.js";

const AXIS_SWEEP_ITERATIONS = 16;

function cornerBlocksMove(
  world: WorldView,
  body: BodyState,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  const tileX = Math.floor(cx);
  const tileY = Math.floor(cy);
  if (!world.isWalkable(tileX, tileY) || blocked?.(tileX, tileY)) return true;
  const onStair = world.stairHeightAt(body.x, body.y) !== null ||
    world.stairHeightAt(cx, cy) !== null;
  if (body.grounded && onStair) {
    return stairGateBlocks(world, body, cx, cy, dx, dy);
  }
  const terrain = world.groundAt(cx, cy);
  if (body.grounded) return terrain - body.z > STEP_UP;
  return terrain > body.z + AIRBORNE_LEDGE_CLEARANCE;
}

export function canMoveAxis(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  if (dx !== 0) {
    const edgeX = body.x + dx + Math.sign(dx) * BODY_RADIUS;
    return !cornerBlocksMove(
      world, body, edgeX, body.y - BODY_RADIUS, dx, 0, blocked,
    ) && !cornerBlocksMove(
      world, body, edgeX, body.y + BODY_RADIUS, dx, 0, blocked,
    );
  }
  const edgeY = body.y + dy + Math.sign(dy) * BODY_RADIUS;
  return !cornerBlocksMove(
    world, body, body.x - BODY_RADIUS, edgeY, 0, dy, blocked,
  ) && !cornerBlocksMove(
    world, body, body.x + BODY_RADIUS, edgeY, 0, dy, blocked,
  );
}

export function moveAxisToContact(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): number {
  if (dx === 0 && dy === 0) return 1;
  if (canMoveAxis(world, body, dx, dy, blocked)) {
    body.x += dx;
    body.y += dy;
    return 1;
  }
  let safe = 0;
  let blockedFraction = 1;
  for (let iteration = 0; iteration < AXIS_SWEEP_ITERATIONS; iteration++) {
    const candidate = (safe + blockedFraction) / 2;
    if (canMoveAxis(world, body, dx * candidate, dy * candidate, blocked)) {
      safe = candidate;
    } else {
      blockedFraction = candidate;
    }
  }
  body.x += dx * safe;
  body.y += dy * safe;
  return safe;
}
