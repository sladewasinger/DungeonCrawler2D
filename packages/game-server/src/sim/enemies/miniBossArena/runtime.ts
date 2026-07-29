import type { MiniBossArenaGate } from "@dc2d/engine";
import type { SimState } from "../../state/state.js";

export interface MiniBossArenaEntry {
  readonly arenaKey: string;
  readonly playerId: string;
  readonly gate: MiniBossArenaGate;
  waypointIndex: number;
}

interface MiniBossArenaRuntime {
  readonly occupants: Map<string, Set<string>>;
  readonly entries: Map<string, MiniBossArenaEntry>;
}

const runtimeBySim = new WeakMap<SimState, MiniBossArenaRuntime>();

function runtimeFor(sim: SimState): MiniBossArenaRuntime {
  const existing = runtimeBySim.get(sim);
  if (existing) return existing;
  const created = {
    occupants: new Map<string, Set<string>>(),
    entries: new Map<string, MiniBossArenaEntry>(),
  };
  runtimeBySim.set(sim, created);
  return created;
}

export function miniBossArenaOccupants(
  sim: SimState,
  arenaKey: string,
): Set<string> {
  const arenas = runtimeFor(sim).occupants;
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
  for (const occupants of runtimeFor(sim).occupants.values()) {
    if (occupants.has(playerId)) return true;
  }
  return false;
}

export function isMiniBossArenaOccupant(
  sim: SimState,
  arenaKey: string,
  playerId: string,
): boolean {
  return runtimeFor(sim).occupants.get(arenaKey)?.has(playerId) ?? false;
}

export function beginMiniBossArenaEntry(
  sim: SimState,
  entry: Omit<MiniBossArenaEntry, "waypointIndex">,
): void {
  runtimeFor(sim).entries.set(entry.arenaKey, {
    ...entry,
    waypointIndex: 0,
  });
}

export function miniBossArenaEntryForArena(
  sim: SimState,
  arenaKey: string,
): MiniBossArenaEntry | undefined {
  return runtimeFor(sim).entries.get(arenaKey);
}

export function miniBossArenaEntryForPlayer(
  sim: SimState,
  playerId: string,
): MiniBossArenaEntry | undefined {
  return miniBossArenaEntries(sim).find((entry) =>
    entry.playerId === playerId
  );
}

export function miniBossArenaEntries(
  sim: SimState,
): readonly MiniBossArenaEntry[] {
  return [...runtimeFor(sim).entries.values()]
    .sort((left, right) => left.arenaKey.localeCompare(right.arenaKey));
}

export function completeMiniBossArenaEntry(
  sim: SimState,
  arenaKey: string,
): void {
  const entry = runtimeFor(sim).entries.get(arenaKey);
  if (!entry) return;
  runtimeFor(sim).entries.delete(arenaKey);
  occupyMiniBossArena(sim, arenaKey, entry.playerId);
}

export function clearMiniBossArena(
  sim: SimState,
  arenaKey: string,
): boolean {
  const runtime = runtimeFor(sim);
  runtime.occupants.delete(arenaKey);
  return runtime.entries.delete(arenaKey);
}

export function removeMiniBossArenaPlayer(
  sim: SimState,
  playerId: string,
): boolean {
  const runtime = runtimeFor(sim);
  let gateChanged = false;
  for (const [arenaKey, occupants] of runtime.occupants) {
    occupants.delete(playerId);
    if (occupants.size === 0) runtime.occupants.delete(arenaKey);
  }
  for (const [arenaKey, entry] of runtime.entries) {
    if (entry.playerId !== playerId) continue;
    runtime.entries.delete(arenaKey);
    gateChanged = true;
  }
  return gateChanged;
}
