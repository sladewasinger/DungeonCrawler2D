import {
  GRAVITY,
  MAX_THROW_RANGE,
  THROW_SPEED,
} from "../../core/constants.js";
import type {
  BallisticFlight,
  BallisticPoint,
  BallisticThrow,
  BallisticThrowRequest,
  BallisticThrowSampleRequest,
} from "./contract.js";

/** Velocity that arcs from `from` (at z0) to land at `to` in dist/speed seconds. */
export function launchVelocity(
  from: BallisticPoint,
  to: BallisticPoint,
  speed: number,
): BallisticPoint {
  return velocityForDuration(from, to, ballisticDuration(from, to, speed));
}

/** Samples the resolved arc, including its exact launch and landing points. */
export function sampleBallisticThrow(
  request: BallisticThrowSampleRequest,
): readonly BallisticPoint[] {
  const segments = Math.max(2, request.segments ?? 20);
  return Array.from(
    { length: segments + 1 },
    (_, index) => pointAtProgress(request, index / segments),
  );
}

/** Shared target contract for every item that follows a ballistic arc. */
export function resolveBallisticThrow(
  request: BallisticThrowRequest,
): BallisticThrow {
  const target = clampedGroundTarget(request);
  const speed = request.speed ?? THROW_SPEED;
  const duration = ballisticDuration(request.from, target, speed);
  return {
    target,
    vel: velocityForDuration(request.from, target, duration),
    duration,
  };
}

/** Samples a flight at a known elapsed duration without mutating its state. */
export function sampleBallisticFlight(
  flight: BallisticFlight,
  elapsed: number,
): BallisticPoint {
  if (elapsed <= 0) return flight.origin;
  if (elapsed >= flight.duration) return flight.target;
  return pointAtElapsed(flight.origin, flight.vel, elapsed);
}

/** Instantaneous velocity at an elapsed flight duration. */
export function ballisticVelocityAt(
  flight: BallisticFlight,
  elapsed: number,
): BallisticPoint {
  return {
    x: flight.vel.x,
    y: flight.vel.y,
    z: flight.vel.z - GRAVITY * elapsed,
  };
}

function clampedGroundTarget(request: BallisticThrowRequest): BallisticPoint {
  const maxRange = request.maxRange ?? MAX_THROW_RANGE;
  const { x, y } = clampedTargetCoordinates(request.from, request.target, maxRange);
  return { x, y, z: request.world.groundAt(x, y) };
}

function clampedTargetCoordinates(
  from: BallisticPoint,
  target: Readonly<{ x: number; y: number }>,
  maxRange: number,
): Readonly<{ x: number; y: number }> {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxRange ? maxRange / distance : 1;
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

function pointAtProgress(
  request: BallisticThrowSampleRequest,
  progress: number,
): BallisticPoint {
  if (progress <= 0) return request.origin;
  if (progress >= 1) return request.ballistic.target;
  return pointAtElapsed(
    request.origin,
    request.ballistic.vel,
    request.ballistic.duration * progress,
  );
}

function ballisticDuration(
  from: BallisticPoint,
  to: BallisticPoint,
  speed: number,
): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(0.001, distance) / speed;
}

function velocityForDuration(
  from: BallisticPoint,
  to: BallisticPoint,
  duration: number,
): BallisticPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const vz = (to.z - from.z + (GRAVITY / 2) * duration * duration) /
    duration;
  return { x: dx / duration, y: dy / duration, z: vz };
}

function pointAtElapsed(
  origin: BallisticPoint,
  vel: BallisticPoint,
  elapsed: number,
): BallisticPoint {
  return {
    x: origin.x + vel.x * elapsed,
    y: origin.y + vel.y * elapsed,
    z: origin.z + vel.z * elapsed - (GRAVITY / 2) * elapsed * elapsed,
  };
}
