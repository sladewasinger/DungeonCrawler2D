// Pure projectile-facing math: rotates a projectile sprite to point along its velocity.
/** Facing angle (degrees) for a projectile's current velocity — 0 for a stationary one. */
export function velocityAngleDegrees(vx: number, vy: number): number {
  if (vx === 0 && vy === 0) return 0;
  return (Math.atan2(vy, vx) * 180) / Math.PI;
}
