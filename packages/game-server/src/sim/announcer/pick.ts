// Deterministic line-pool index picker for the announcer — tick-seeded hash, never Math.random.

/**
 * Picks a stable index into a pool of size `poolSize`, seeded by the
 * current tick plus a per-event salt (player id, level, kill count…) so
 * two events landing on the same tick still diverge, and the same
 * (tick, salt) pair always reproduces the same line — the invariant the
 * rotation-coverage and determinism tests rely on.
 */
export function pickLineIndex(tick: number, salt: string, poolSize: number): number {
  let hash = (tick >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < salt.length; i++) {
    hash = Math.imul(hash ^ salt.charCodeAt(i), 16777619);
  }
  hash ^= hash >>> 15;
  return Math.abs(hash) % poolSize;
}
