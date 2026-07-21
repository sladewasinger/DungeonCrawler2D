// Pure whiff-vs-connect resolution for the melee wedge telegraph (panel round 3b item 5,
// WHIFF FEEDBACK): a swing that lands no hit within a short window after it starts is a
// whiff and gets its own gray arc-fade cue (whiffFade.ts); one that does gets nothing
// extra here (the existing blood splatter already reads as "connected"). Kept Phaser-free
// so the correlation logic is unit-testable apart from any Graphics object — mirrors
// meleeWedgeGeometry.ts's split between pure geometry and the Phaser-side drawer.
//
// The network's "hit" event (engine/net/server.ts) carries only the TARGET id, not an
// attacker id, so there's no exact way to attribute a landed hit to a specific swing.
// This approximates the server's own melee resolution (combat/melee.ts's range/arc
// check) against each swing's own captured origin/angle, with slack for the client's
// only-approximate timing and positions — good enough for a feel cue, not gameplay.
import { MELEE_ARC_COS, MELEE_RANGE } from "@dc2d/engine";

/** Generous slack over the server's real reach/arc: err toward calling an ambiguous
 * case a connect rather than false-flashing a whiff cue on a real hit. */
const RANGE_SLACK_TILES = 0.5;
const ARC_SLACK_RAD = 0.25;

/** How long a swing waits for a correlating hit before it's declared a whiff. Clears the
 * wedge's own 160ms fade (meleeWedgeGeometry.ts) plus slack for one network round trip. */
export const WHIFF_TIMEOUT_MS = 260;

export interface PendingSwing {
  readonly attackerId: string;
  readonly worldX: number;
  readonly worldY: number;
  readonly z: number;
  readonly angleRad: number;
  readonly depth: number;
  readonly startedAtMs: number;
}

/** Registers a freshly-spawned swing as awaiting a correlating hit; replaces any prior
 * pending swing for the same attacker (there's only ever one swing in flight per id, the
 * cooldown-gated attack rate — see input/pointer.ts's ATTACK_COOLDOWN_MS). */
export function registerPendingSwing(pending: Map<string, PendingSwing>, swing: PendingSwing): void {
  pending.set(swing.attackerId, swing);
}

/** True if a hit landing at (hitX, hitY) is plausibly this swing's target — same
 * range/arc shape as the engine's real melee resolution, with slack (see module doc). */
export function hitPlausiblyFromSwing(swing: PendingSwing, hitX: number, hitY: number): boolean {
  const dx = hitX - swing.worldX;
  const dy = hitY - swing.worldY;
  const dist = Math.hypot(dx, dy);
  if (dist > MELEE_RANGE + RANGE_SLACK_TILES) return false;
  if (dist < 0.001) return true;
  const nx = Math.cos(swing.angleRad);
  const ny = Math.sin(swing.angleRad);
  const dot = (dx / dist) * nx + (dy / dist) * ny;
  const offAxisRad = Math.acos(Math.min(1, Math.max(-1, dot)));
  return offAxisRad <= Math.acos(MELEE_ARC_COS) + ARC_SLACK_RAD;
}

/**
 * Resolves (removes) the pending swing a hit at (hitX, hitY) plausibly belongs to, if
 * any — call once per "hit" event so a real connect never also flashes a whiff once its
 * timeout later elapses. Prefers the most recently started matching swing.
 */
export function resolveHitAgainstPending(pending: Map<string, PendingSwing>, hitX: number, hitY: number): void {
  let bestId: string | null = null;
  let bestStart = -Infinity;
  for (const [id, swing] of pending) {
    if (!hitPlausiblyFromSwing(swing, hitX, hitY)) continue;
    if (swing.startedAtMs <= bestStart) continue;
    bestId = id;
    bestStart = swing.startedAtMs;
  }
  if (bestId !== null) pending.delete(bestId);
}

/** Removes and returns every pending swing whose WHIFF_TIMEOUT_MS has elapsed without a
 * correlating hit — these are the swings to flash the whiff cue for this frame. */
export function collectExpiredSwings(pending: Map<string, PendingSwing>, nowMs: number): PendingSwing[] {
  const expired: PendingSwing[] = [];
  for (const [id, swing] of pending) {
    if (nowMs - swing.startedAtMs < WHIFF_TIMEOUT_MS) continue;
    expired.push(swing);
    pending.delete(id);
  }
  return expired;
}
