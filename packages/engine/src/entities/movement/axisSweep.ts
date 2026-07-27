import { AIRBORNE_LEDGE_CLEARANCE, STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import {
  BODY_RADIUS,
  type BodyState,
  type StepOpts,
} from "./state.js";
import { stairGateBlocks } from "./stairGate.js";

const AXIS_SWEEP_ITERATIONS = 16;

interface AxisMove {
  dx: number;
  dy: number;
}

interface AxisSweepContext extends AxisMove {
  world: WorldView;
  body: BodyState;
  blocked?: StepOpts["blocked"];
}

interface CornerProbe extends AxisSweepContext {
  x: number;
  y: number;
}

function cornerBlocksMove({ world, body, x: cx, y: cy, dx, dy, blocked }: CornerProbe): boolean {
  const tileX = Math.floor(cx);
  const tileY = Math.floor(cy);
  if (!world.isWalkable(tileX, tileY) || blocked?.(tileX, tileY)) return true;
  const onStair = world.stairHeightAt(body.x, body.y) !== null ||
    world.stairHeightAt(cx, cy) !== null;
  if (body.grounded && onStair) {
    return stairGateBlocks({ world, body, x: cx, y: cy, dx, dy });
  }
  const terrain = world.groundAt(cx, cy);
  if (body.grounded) return terrain - body.z > STEP_UP;
  return terrain > body.z + AIRBORNE_LEDGE_CLEARANCE;
}

function edgeCorners({ body, dx, dy }: AxisMove & Pick<AxisSweepContext, "body">): readonly [number, number][] {
  if (dx !== 0) {
    const edgeX = body.x + dx + Math.sign(dx) * BODY_RADIUS;
    return [[edgeX, body.y - BODY_RADIUS], [edgeX, body.y + BODY_RADIUS]];
  }
  const edgeY = body.y + dy + Math.sign(dy) * BODY_RADIUS;
  return [[body.x - BODY_RADIUS, edgeY], [body.x + BODY_RADIUS, edgeY]];
}

export function canMoveAxis(context: AxisSweepContext): boolean {
  return edgeCorners(context).every(([x, y]) => !cornerBlocksMove({ ...context, x, y }));
}

function applyMove(body: BodyState, { dx, dy }: AxisMove, fraction: number): void {
  body.x += dx * fraction;
  body.y += dy * fraction;
}

function contactFraction(context: AxisSweepContext): number {
  if (canMoveAxis(context)) return 1;
  let safe = 0;
  let blockedFraction = 1;
  for (let iteration = 0; iteration < AXIS_SWEEP_ITERATIONS; iteration++) {
    const candidate = (safe + blockedFraction) / 2;
    if (canMoveAxis({ ...context, dx: context.dx * candidate, dy: context.dy * candidate })) safe = candidate;
    else blockedFraction = candidate;
  }
  return safe;
}

export function moveAxisToContact(context: AxisSweepContext): number {
  const { body, dx, dy } = context;
  if (dx === 0 && dy === 0) return 1;
  const fraction = contactFraction(context);
  applyMove(body, context, fraction);
  return fraction;
}
