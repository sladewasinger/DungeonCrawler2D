// Announcer-private kill tally, scoped entirely to this subsystem.
import type { PlayerSlot } from "../state.js";

/**
 * WeakMap keyed by PlayerSlot rather than a SimState field: this count is
 * flavor-only (kill-milestone lines), never read outside the announcer,
 * and safe to lose on reconnect/restart — it isn't the source of truth
 * for any stat, so it doesn't belong on the shared sim state contract.
 * Session-scoped by construction: entries die with their PlayerSlot.
 */
const killCounts = new WeakMap<PlayerSlot, number>();

/** Increments and returns this player's tracked kill count for the session. */
export function recordKill(slot: PlayerSlot): number {
  const next = (killCounts.get(slot) ?? 0) + 1;
  killCounts.set(slot, next);
  return next;
}
