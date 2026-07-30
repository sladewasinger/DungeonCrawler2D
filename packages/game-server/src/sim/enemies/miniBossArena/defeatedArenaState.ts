import type { SimState } from "../../state/state.js";

interface DefeatedArenaState {
  revision: number;
}

const states = new WeakMap<SimState, DefeatedArenaState>();

/** Records an irreversible arena clear and advances its gate-override revision. */
export function markMiniBossArenaDefeated(
  sim: SimState,
  arenaKey: string,
): boolean {
  if (sim.defeatedMiniBossArenas.has(arenaKey)) return false;
  sim.defeatedMiniBossArenas.add(arenaKey);
  stateFor(sim).revision++;
  return true;
}

export function defeatedMiniBossArenaRevision(sim: SimState): number {
  return stateFor(sim).revision;
}

function stateFor(sim: SimState): DefeatedArenaState {
  const existing = states.get(sim);
  if (existing) return existing;
  const state = { revision: 0 };
  states.set(sim, state);
  return state;
}
