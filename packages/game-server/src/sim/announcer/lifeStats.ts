// Per-life run-stat tracking for the audience-rating derivation (panel round 3b,
// "Small" item — the death line's "rates it a 6 out of 10" never varying). Mirrors
// killCounts.ts's WeakMap-per-slot pattern, scoped entirely to this subsystem: lost on
// reconnect/restart same as the milestone tally, which is fine since it only ever feeds
// flavor text, never a persisted stat. Deliberately does NOT hook sim/spawn.ts or
// players.ts's respawnSlot (another lane's files this wave) — life-start is seeded
// lazily the first time deaths.ts observes a slot, which lands within one tick of the
// real join/respawn since that call site runs unconditionally every tick.
import type { PlayerSlot } from "../state.js";
import { getKillCount } from "./killCounts.js";

interface LifeMark {
  readonly startedAtTick: number;
  readonly killsAtStart: number;
}

const lifeMarks = new WeakMap<PlayerSlot, LifeMark>();

/**
 * Seeds this slot's life-start bookkeeping the first time it's observed — a no-op once
 * already tracked, so callers can call this unconditionally on every tick (including
 * ticks where the player doesn't die) without resetting a life already in progress.
 */
export function ensureLifeTracked(slot: PlayerSlot, tick: number): void {
  if (lifeMarks.has(slot)) return;
  lifeMarks.set(slot, { startedAtTick: tick, killsAtStart: getKillCount(slot) });
}

export interface LifeStats {
  readonly killsThisLife: number;
  readonly survivalTicks: number;
}

/**
 * Snapshots this life's kills/duration at the moment of death, then resets the mark so
 * the next life starts counting fresh from `tick`. The real respawn lands a handful of
 * ticks later (RESPAWN_DELAY_TICKS), so this slightly overstates the next life's
 * eventual survival time — acceptable since it's flavor bookkeeping, not gameplay state.
 */
export function takeLifeStats(slot: PlayerSlot, tick: number): LifeStats {
  ensureLifeTracked(slot, tick);
  // ensureLifeTracked is a no-op when already tracked, so this read is always the
  // pre-existing mark (never the just-seeded fallback) once a slot has a real life.
  const mark = lifeMarks.get(slot) as LifeMark;
  const killsThisLife = Math.max(0, getKillCount(slot) - mark.killsAtStart);
  const survivalTicks = Math.max(0, tick - mark.startedAtTick);
  lifeMarks.set(slot, { startedAtTick: tick, killsAtStart: getKillCount(slot) });
  return { killsThisLife, survivalTicks };
}
