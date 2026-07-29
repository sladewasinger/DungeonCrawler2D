/** Pure world-space geometry for the held-throw trajectory preview. */
export interface ThrowArcPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ThrowArcRequest {
  readonly origin: ThrowArcPoint;
  readonly target: ThrowArcPoint;
  readonly segments?: number;
}

/** Samples a physical-looking ballistic guide: linear horizontal travel and a
 * quadratic vertical arch returning exactly to the destination elevation. */
export function parabolicThrowArc(
  request: ThrowArcRequest,
): readonly ThrowArcPoint[] {
  const segments = Math.max(2, request.segments ?? 20);
  const distance = Math.hypot(
    request.target.x - request.origin.x,
    request.target.y - request.origin.y,
  );
  const apex = Math.max(0.75, distance * 0.35);
  return Array.from(
    { length: segments + 1 },
    (_, index) => {
      if (index === 0) return request.origin;
      if (index === segments) return request.target;
      return arcPoint(request, index / segments, apex);
    },
  );
}

function arcPoint(
  request: ThrowArcRequest,
  progress: number,
  apex: number,
): ThrowArcPoint {
  const arch = 4 * apex * progress * (1 - progress);
  return {
    x: lerp(request.origin.x, request.target.x, progress),
    y: lerp(request.origin.y, request.target.y, progress),
    z: lerp(request.origin.z, request.target.z, progress) + arch,
  };
}

const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;
