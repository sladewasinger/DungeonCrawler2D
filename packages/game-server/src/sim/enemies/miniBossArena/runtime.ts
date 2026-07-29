import type { SimState } from "../../state/state.js";

const occupantsBySim = new WeakMap<SimState, Map<string, Set<string>>>();

function arenaMap(sim: SimState): Map<string, Set<string>> {
  const existing = occupantsBySim.get(sim);
  if (existing) return existing;
  const created = new Map<string, Set<string>>();
  occupantsBySim.set(sim, created);
  return created;
}

export function miniBossArenaOccupants(
  sim: SimState,
  arenaKey: string,
): Set<string> {
  const arenas = arenaMap(sim);
  const existing = arenas.get(arenaKey);
  if (existing) return existing;
  const created = new Set<string>();
  arenas.set(arenaKey, created);
  return created;
}

export function occupyMiniBossArena(
  sim: SimState,
  arenaKey: string,
  playerId: string,
): void {
  miniBossArenaOccupants(sim, arenaKey).add(playerId);
}

export function occupiesMiniBossArena(
  sim: SimState,
  playerId: string,
): boolean {
  for (const occupants of arenaMap(sim).values()) {
    if (occupants.has(playerId)) return true;
  }
  return false;
}

export function clearMiniBossArena(
  sim: SimState,
  arenaKey: string,
): void {
  arenaMap(sim).delete(arenaKey);
}

export function removeMiniBossArenaPlayer(
  sim: SimState,
  playerId: string,
): void {
  for (const [arenaKey, occupants] of arenaMap(sim)) {
    occupants.delete(playerId);
    if (occupants.size === 0) arenaMap(sim).delete(arenaKey);
  }
}
