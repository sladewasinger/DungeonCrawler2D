import { MELEE_ARC_COS } from "../../core/constants.js";

/** A short, authoritative shield volume. It is intentionally much shorter than melee reach. */
export const GUARD_COLLISION_RADIUS_TILES = 0.68;
export const GUARD_COLLISION_ARC_COS = MELEE_ARC_COS;

const SWEEP_SAMPLE_SPACING_TILES = 0.04;
const SWEEP_REFINEMENT_STEPS = 12;

export interface GuardPoint {
  readonly x: number;
  readonly y: number;
}

export interface GuardVolume {
  readonly center: GuardPoint;
  readonly facing: GuardPoint;
  readonly radius: number;
  readonly arcCos: number;
}

export interface GuardVolumeInput {
  readonly center: GuardPoint;
  readonly facing: GuardPoint;
  readonly radius?: number;
  readonly arcCos?: number;
}

export interface GuardCircle {
  readonly center: GuardPoint;
  readonly radius: number;
}

export interface GuardSweep {
  readonly guard: GuardVolume;
  readonly start: GuardPoint;
  readonly end: GuardPoint;
  readonly radius: number;
}

export function guardVolume({
  center,
  facing,
  radius = GUARD_COLLISION_RADIUS_TILES,
  arcCos = GUARD_COLLISION_ARC_COS,
}: GuardVolumeInput): GuardVolume {
  return { center, facing: normalized(facing), radius, arcCos };
}

/** Tests a full moving-body disc, not just its center point, against a held shield. */
export function circleTouchesGuard({ center, radius }: GuardCircle, guard: GuardVolume): boolean {
  const offset = relativePoint(guard.center, center);
  const distance = Math.hypot(offset.x, offset.y);
  if (distance > guard.radius + radius) return false;
  if (distance <= radius) return true;
  return isWithinExpandedGuardArc({ guard, offset, distance, radius });
}

/** Returns the first [0, 1] contact point for a moving enemy body, if any. */
export function firstGuardSweepContact({ guard, start, end, radius }: GuardSweep): number | undefined {
  if (circleTouchesGuard({ center: start, radius }, guard)) return 0;
  const steps = sweepSteps(start, end);
  return findSweepContact({ guard, start, end, radius, steps });
}

interface SweepSearch extends GuardSweep {
  readonly steps: number;
}

function findSweepContact({ guard, start, end, radius, steps }: SweepSearch): number | undefined {
  let safe = 0;
  for (let index = 1; index <= steps; index += 1) {
    const blocked = index / steps;
    if (circleTouchesGuard({ center: interpolate(start, end, blocked), radius }, guard)) {
      return refineSweepContact({ guard, start, end, radius, safe, blocked });
    }
    safe = blocked;
  }
  return undefined;
}

interface SweepRefinement extends GuardSweep {
  readonly safe: number;
  readonly blocked: number;
}

function refineSweepContact(input: SweepRefinement): number {
  let { safe, blocked } = input;
  for (let step = 0; step < SWEEP_REFINEMENT_STEPS; step += 1) {
    const candidate = (safe + blocked) / 2;
    if (circleTouchesGuard({ center: interpolate(input.start, input.end, candidate), radius: input.radius }, input.guard)) {
      blocked = candidate;
    } else {
      safe = candidate;
    }
  }
  return blocked;
}

function isWithinExpandedGuardArc(input: {
  readonly guard: GuardVolume;
  readonly offset: GuardPoint;
  readonly distance: number;
  readonly radius: number;
}): boolean {
  const { guard, offset, distance, radius } = input;
  const allowance = Math.asin(Math.min(1, radius / distance));
  const allowedAngle = Math.acos(guard.arcCos) + allowance;
  const dot = (guard.facing.x * offset.x + guard.facing.y * offset.y) / distance;
  return dot >= Math.cos(Math.min(Math.PI, allowedAngle));
}

function sweepSteps(start: GuardPoint, end: GuardPoint): number {
  return Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / SWEEP_SAMPLE_SPACING_TILES));
}

function interpolate(start: GuardPoint, end: GuardPoint, fraction: number): GuardPoint {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function relativePoint(origin: GuardPoint, target: GuardPoint): GuardPoint {
  return { x: target.x - origin.x, y: target.y - origin.y };
}

function normalized(point: GuardPoint): GuardPoint {
  const length = Math.hypot(point.x, point.y);
  if (length <= 0.001) return { x: 1, y: 0 };
  return { x: point.x / length, y: point.y / length };
}
