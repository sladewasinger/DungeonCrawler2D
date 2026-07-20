import type { VisualEvent } from "./connectionTypes.js";

/**
 * Derives XP-gain/level-up visual events from consecutive self snapshots — the wire
 * protocol only carries the cumulative `xp`/`level` totals (net/server.ts's
 * selfSnapshotSchema), no dedicated "you gained N xp" or "you leveled up" event, so
 * apply.ts diffs against the previously applied values each snapshot.
 */
export interface XpState {
  readonly xp: number;
  readonly level: number;
}

/** Death never removes XP (game-server/sim/xp.ts), so any rise is a genuine gain —
 * a same-tick level-up rides alongside its xpGained event, never replaces it. */
export function xpGainEvents(prev: XpState, next: XpState): VisualEvent[] {
  const events: VisualEvent[] = [];
  const gained = next.xp - prev.xp;
  if (gained > 0) events.push({ t: "xpGained", amount: gained });
  if (next.level > prev.level) events.push({ t: "levelUp", level: next.level });
  return events;
}
