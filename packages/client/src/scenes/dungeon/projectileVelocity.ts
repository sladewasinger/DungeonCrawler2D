// Projectile facing/trail needs a velocity vector, but the wire protocol never sends
// one (entitySnapshotSchema has no vx/vy) — this derives it from the position delta
// between consecutive interpolated samples, the same technique playerMotion.ts uses
// for other players' idle/walk inference.
export interface ProjectileVelocityState {
  readonly samples: Map<string, { x: number; y: number; t: number }>;
}

export function createProjectileVelocityState(): ProjectileVelocityState {
  return { samples: new Map() };
}

export interface Velocity {
  readonly vx: number;
  readonly vy: number;
}

/** Records this frame's position and returns the velocity implied since the last one (zero on first sight). */
export function trackProjectileVelocity(
  state: ProjectileVelocityState,
  id: string,
  x: number,
  y: number,
  nowMs: number,
): Velocity {
  const previous = state.samples.get(id);
  state.samples.set(id, { x, y, t: nowMs });
  if (!previous) return { vx: 0, vy: 0 };
  const dt = (nowMs - previous.t) / 1000;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (x - previous.x) / dt, vy: (y - previous.y) / dt };
}

/** Drops tracked samples for ids no longer present, so the map stays bounded. */
export function pruneProjectileVelocity(state: ProjectileVelocityState, liveIds: ReadonlySet<string>): void {
  for (const id of state.samples.keys()) {
    if (!liveIds.has(id)) state.samples.delete(id);
  }
}
