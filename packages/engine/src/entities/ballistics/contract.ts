export interface BallisticPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const THROW_LAUNCH_HEIGHT = 1;

export interface BallisticThrowRequest {
  readonly world: import("../../world/core/types.js").WorldView;
  readonly from: BallisticPoint;
  readonly target: Readonly<{ x: number; y: number }>;
  readonly maxRange?: number;
  readonly speed?: number;
}

export interface BallisticThrow {
  readonly target: BallisticPoint;
  readonly vel: BallisticPoint;
  readonly duration: number;
}

/** Exact launch, accepted landing point, and elapsed flight time for a throw. */
export interface BallisticFlight extends BallisticThrow {
  readonly origin: BallisticPoint;
  elapsed: number;
}

export interface BallisticThrowSampleRequest {
  readonly origin: BallisticPoint;
  readonly ballistic: BallisticThrow;
  readonly segments?: number;
}

/** Launches every player-thrown item from the same height above its carrier. */
export function throwLaunchOrigin(origin: BallisticPoint): BallisticPoint {
  return { ...origin, z: origin.z + THROW_LAUNCH_HEIGHT };
}

/** Captures a resolved throw as the endpoint-aware contract used while flying. */
export function createBallisticFlight(
  origin: BallisticPoint,
  ballistic: BallisticThrow,
): BallisticFlight {
  return { ...ballistic, origin, elapsed: 0 };
}
