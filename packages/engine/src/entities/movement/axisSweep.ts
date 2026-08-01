import { AIRBORNE_LEDGE_CLEARANCE, STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import {
  BODY_RADIUS,
  type BodyState,
  type StepOpts,
} from "./state.js";
import { stairGateBlocks } from "./stairGate.js";

const AXIS_SWEEP_ITERATIONS = 16;
const DIAGONAL_ESCAPE_STEPS = 16;
const DIAGONAL_ESCAPE_LOOKAHEAD = 4;

interface AxisMove {
  dx: number;
  dy: number;
}

interface AxisSweepContext extends AxisMove {
  world: WorldView;
  body: BodyState;
  blocked?: StepOpts["blocked"];
}

export interface BodyOccupancyContext {
  readonly world: WorldView;
  readonly body: BodyState;
  readonly x: number;
  readonly y: number;
  readonly blocked?: StepOpts["blocked"];
}

interface CornerProbe extends AxisSweepContext {
  x: number;
  y: number;
}

function cornerBlocksMove({ world, body, x: cx, y: cy, dx, dy, blocked }: CornerProbe): boolean {
  const tileX = Math.floor(cx);
  const tileY = Math.floor(cy);
  if (!world.isWalkable(tileX, tileY) || blocked?.(cx, cy)) return true;
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

function bodyCorners(body: BodyState, x = body.x, y = body.y): readonly [number, number][] {
  return [
    [x - BODY_RADIUS, y - BODY_RADIUS], [x - BODY_RADIUS, y + BODY_RADIUS],
    [x + BODY_RADIUS, y - BODY_RADIUS], [x + BODY_RADIUS, y + BODY_RADIUS],
  ];
}

export function canOccupyBodyAt(input: BodyOccupancyContext): boolean {
  const { body, x, y } = input;
  const dx = x - body.x;
  const dy = y - body.y;
  return bodyCorners(body, x, y).every(([cx, cy]) => cornerIsOpen({
    ...input,
    dx,
    dy,
    x: cx,
    y: cy,
  }));
}

function canOccupy(context: AxisSweepContext): boolean {
  return canOccupyBodyAt({
    world: context.world,
    body: context.body,
    x: context.body.x + context.dx,
    y: context.body.y + context.dy,
    blocked: context.blocked,
  });
}

function cornerIsOpen(context: CornerProbe): boolean {
  return !cornerBlocksMove(context);
}

export function canMoveAxis(context: AxisSweepContext): boolean {
  return edgeCorners(context).every(([x, y]) => cornerIsOpen({ ...context, x, y }));
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

function diagonalEscapeFraction(context: AxisSweepContext): number {
  if (canOccupy({ ...context, dx: 0, dy: 0 })) return diagonalContactFraction(context);
  for (let step = 1; step <= DIAGONAL_ESCAPE_STEPS; step++) {
    const fraction = step / DIAGONAL_ESCAPE_STEPS;
    if (canOccupy({ ...context, dx: context.dx * fraction, dy: context.dy * fraction })) {
      return refineDiagonalEscape(context, (step - 1) / DIAGONAL_ESCAPE_STEPS, fraction);
    }
  }
  return hasFutureEscape(context) ? 1 : 0;
}

function hasFutureEscape(context: AxisSweepContext): boolean {
  for (let step = 1; step <= DIAGONAL_ESCAPE_STEPS; step++) {
    const fraction = (step / DIAGONAL_ESCAPE_STEPS) * DIAGONAL_ESCAPE_LOOKAHEAD;
    if (canOccupy({ ...context, dx: context.dx * fraction, dy: context.dy * fraction })) return true;
  }
  return false;
}

function diagonalContactFraction(context: AxisSweepContext): number {
  if (canOccupy(context)) return 1;
  let safe = 0;
  let blocked = 1;
  for (let iteration = 0; iteration < AXIS_SWEEP_ITERATIONS; iteration++) {
    const candidate = (safe + blocked) / 2;
    if (canOccupy({ ...context, dx: context.dx * candidate, dy: context.dy * candidate })) safe = candidate;
    else blocked = candidate;
  }
  return safe;
}

function refineDiagonalEscape(context: AxisSweepContext, blocked: number, open: number): number {
  for (let iteration = 0; iteration < AXIS_SWEEP_ITERATIONS; iteration++) {
    const candidate = (blocked + open) / 2;
    if (canOccupy({ ...context, dx: context.dx * candidate, dy: context.dy * candidate })) open = candidate;
    else blocked = candidate;
  }
  return open;
}

/** Lets a body leave a two-sided corner when both axis-only moves are blocked. */
export function moveDiagonalToContact(context: AxisSweepContext): number {
  if (context.dx === 0 || context.dy === 0) return 0;
  const fraction = diagonalEscapeFraction(context);
  applyMove(context.body, context, fraction);
  return fraction;
}
