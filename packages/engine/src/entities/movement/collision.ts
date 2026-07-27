import { KNOCKBACK_DECAY } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import {
  CORNER_SLIDE_WINDOW,
  type BodyState,
  type MoveInput,
  type StepOpts,
} from "./state.js";
import { canMoveAxis, moveAxisToContact } from "./axisSweep.js";

/**
 * Horizontal step + tile collision: analog-magnitude direction scaling,
 * the leading-edge corner check that keeps bodies out of raised terrain
 * while letting stairs ramp underfoot, and the corner-slide assist that
 * turns an off-center approach to a 1-wide gap into a smooth entry
 * instead of a wall.
 */

/** Scan resolution for the corner-slide search, in tiles. Small enough
 * that the nudge lands within a fraction of a pixel of the true gap
 * edge; cheap since the search only runs on a blocked tick. */
const CORNER_SLIDE_PROBE_STEP = 0.01;

// Scales (moveX, moveY) so its length never exceeds 1, preserving both
// direction and magnitude below that: an analog magnitude in [0,1]
// (e.g. a touch stick's partial deflection) passes through unchanged,
// so speed = base * magnitude, while any raw vector at or past unit
// length (keyboard's -1/0/1 axes, a diagonal (1,1), or a hostile
// overshoot) is normalized to exactly 1 — identical to the old
// axis-clamp-then-normalize-diagonal behavior for every input that
// code path could ever produce.
function scaledDirection(input: MoveInput): [number, number] {
  const magnitude = Math.hypot(input.moveX, input.moveY);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  return [input.moveX * scale, input.moveY * scale];
}

/** Attempt one axis move; mutates `body` and reports whether it moved. */
interface HorizontalMove {
  world: WorldView;
  body: BodyState;
  dx: number;
  dy: number;
  blocked?: StepOpts["blocked"];
}

function tryAxisMove(move: HorizontalMove): boolean {
  return moveAxisToContact(move) === 1;
}

// Scan outward (smallest magnitude first, both signs) from the body's
// current perpendicular position for the nearest offset within
// CORNER_SLIDE_WINDOW at which the blocked move would succeed — the
// centerline nudge target for a 1-wide gap the body is approaching
// slightly off-axis. Exactly one of dx/dy is nonzero (the blocked axis).
function gapOffsets(): number[] {
  const offsets: number[] = [];
  const steps = Math.round(CORNER_SLIDE_WINDOW / CORNER_SLIDE_PROBE_STEP);
  for (let i = 1; i <= steps; i++) {
    const magnitude = i * CORNER_SLIDE_PROBE_STEP;
    offsets.push(magnitude, -magnitude);
  }
  return offsets;
}

function findGapOffset(move: HorizontalMove): number | null {
  const { world, body, dx, dy, blocked } = move;
  for (const offset of gapOffsets()) {
    const probe = dx !== 0 ? { ...body, y: body.y + offset } : { ...body, x: body.x + offset };
    if (canMoveAxis({ world, body: probe, dx, dy, blocked })) return offset;
  }
  return null;
}

// A blocked axis move redirects its own (unused) speed budget into a
// perpendicular nudge toward a nearby gap's centerline instead of
// stalling — the classic Zelda-style corner assist. The nudge itself
// still runs through tryAxisMove's ordinary collision check, so it can
// never land the body in a wall/void the plain move couldn't legally
// enter; it only ever narrows the gap between "blocked" and "through".
function attemptCornerSlide(move: HorizontalMove): void {
  const { dx, dy } = move;
  const budget = Math.abs(dx !== 0 ? dx : dy);
  const offset = findGapOffset(move);
  if (offset === null) return;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), budget);
  if (dx !== 0) tryAxisMove({ ...move, dx: 0, dy: nudge });
  else tryAxisMove({ ...move, dx: nudge, dy: 0 });
}

/** Blend knockback into intent, decay it, and resolve the two axis moves. */
interface HorizontalStep {
  world: WorldView;
  body: BodyState;
  input: MoveInput;
  dt: number;
  speed: number;
  opts: StepOpts;
}

function movementDelta({ input, body, speed, dt, opts }: HorizontalStep): [number, number] {
  const [dirX, dirY] = scaledDirection(input);
  if (opts.stickyFeet) {
    body.kx = 0;
    body.ky = 0;
  }
  const vx = dirX * speed + body.kx;
  const vy = dirY * speed + body.ky;
  body.kx *= KNOCKBACK_DECAY;
  body.ky *= KNOCKBACK_DECAY;
  if (Math.abs(body.kx) < 0.05) body.kx = 0;
  if (Math.abs(body.ky) < 0.05) body.ky = 0;

  return [vx * dt, vy * dt];
}

function moveOneAxis(move: HorizontalMove): number {
  const fraction = moveAxisToContact(move);
  if (fraction < 1 && (move.dx !== 0 || move.dy !== 0)) {
    attemptCornerSlide({ ...move, dx: move.dx * (1 - fraction), dy: move.dy * (1 - fraction) });
  }
  return fraction;
}

export function moveHorizontal({ world, body, input, dt, speed, opts }: HorizontalStep): number {
  const [dx, dy] = movementDelta({ world, body, input, dt, speed, opts });
  const xFraction = moveOneAxis({ world, body, dx, dy: 0, blocked: opts.blocked });
  const yFraction = moveOneAxis({ world, body, dx: 0, dy, blocked: opts.blocked });
  return (xFraction < 1 ? 1 : 0) | (yFraction < 1 ? 2 : 0);
}
