import {
  createBallisticFlight,
  resolveBallisticThrow,
  traceBallisticFlight,
  throwLaunchOrigin,
  type BallisticPoint,
  type WorldView,
} from "@dc2d/engine";

/** Pure world-space geometry for the held-throw trajectory preview. */
export type ThrowArcPoint = BallisticPoint;

export interface ThrowArcRequest {
  readonly origin: ThrowArcPoint;
  readonly target: Readonly<{ x: number; y: number }>;
  readonly world: WorldView;
  readonly segments?: number;
}

export interface ThrowArc {
  readonly points: readonly ThrowArcPoint[];
  readonly target: ThrowArcPoint;
}

/** Resolves and samples the same launch contract used by authoritative throws. */
export function ballisticThrowArc(
  request: ThrowArcRequest,
): ThrowArc {
  const origin = throwLaunchOrigin(request.origin);
  const ballistic = resolveBallisticThrow({
    world: request.world,
    from: origin,
    target: request.target,
  });
  const flight = createBallisticFlight(origin, ballistic);
  const trace = traceThrow(request.world, flight, request.segments);
  return {
    points: trace.points,
    target: trace.impact ?? ballistic.target,
  };
}

function traceThrow(
  world: WorldView,
  flight: ReturnType<typeof createBallisticFlight>,
  segments: number | undefined,
) {
  if (segments === undefined) return traceBallisticFlight({ world, flight });
  return traceBallisticFlight({ world, flight, segments });
}
