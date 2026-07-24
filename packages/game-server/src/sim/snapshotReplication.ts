import type {
  EntitySnapshotDeltaEntry,
  InvStack,
  ServerSnapshotDelta,
  SnapshotMode,
} from "@dc2d/engine";
import type { VersionedEntitySnapshot } from "./entitySnapshots.js";
import { newSnapshotClientState, type SnapshotClientState } from "./snapshotState.js";
import type { PlayerSlot, SimState } from "./state.js";

/** Negotiation and revision tracking for the optional delta snapshot path. */

export function configureSnapshotMode(
  sim: SimState,
  playerId: string,
  mode: SnapshotMode | undefined,
): void {
  const slot = sim.players.get(playerId);
  if (!slot) return;
  if (mode) slot.snapshotMode = mode;
  else delete slot.snapshotMode;
  sim.snapshotClients.delete(playerId);
}

export function requestSnapshotBaseline(sim: SimState, playerId: string): void {
  const slot = sim.players.get(playerId);
  if (!slot?.snapshotMode) return;
  snapshotClientState(sim, slot).forceBaseline = true;
  slot.needsFullAreas = true;
}

export function snapshotClientState(sim: SimState, slot: PlayerSlot): SnapshotClientState {
  const current = sim.snapshotClients.get(slot.entity.id);
  if (current && current.mode === slot.snapshotMode) return current;
  const next = newSnapshotClientState(slot.snapshotMode ?? "delta-v1");
  sim.snapshotClients.set(slot.entity.id, next);
  return next;
}

function inventoryMatches(left: InvStack[], right: InvStack[]): boolean {
  return left.length === right.length &&
    left.every((stack, index) =>
      stack.item === right[index]?.item && stack.qty === right[index]?.qty);
}

function hotbarMatches(left: Array<string | null>, right: Array<string | null>): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function syncInventoryRevision(state: SnapshotClientState, inventory: InvStack[]): boolean {
  if (inventoryMatches(state.inventory, inventory)) return false;
  state.inventory = inventory.map((stack) => ({ ...stack }));
  state.inventoryRevision++;
  return true;
}

export function syncHotbarRevision(
  state: SnapshotClientState,
  hotbar: Array<string | null>,
): boolean {
  if (hotbarMatches(state.hotbar, hotbar)) return false;
  state.hotbar = [...hotbar];
  state.hotbarRevision++;
  return true;
}

export function needsSnapshotBaseline(state: SnapshotClientState): boolean {
  return state.forceBaseline || state.lastTick === null;
}

export function deltaEntityEntries(
  state: SnapshotClientState,
  visible: VersionedEntitySnapshot[],
  baseline: boolean,
): EntitySnapshotDeltaEntry[] {
  const entries = visible.map(({ revision, snapshot }) => {
    if (!baseline && state.entityRevisions.get(snapshot.id) === revision) {
      return { id: snapshot.id, revision, unchanged: true as const };
    }
    return { ...snapshot, revision };
  });
  state.entityRevisions = new Map(
    visible.map(({ revision, snapshot }) => [snapshot.id, revision]),
  );
  return entries;
}

export function finishDeltaSnapshot(
  state: SnapshotClientState,
  snapshot: Omit<ServerSnapshotDelta, "baseTick" | "baseline">,
): ServerSnapshotDelta {
  const baseline = needsSnapshotBaseline(state);
  const result = {
    ...snapshot,
    baseTick: baseline ? null : state.lastTick,
    baseline,
  };
  state.forceBaseline = false;
  state.lastTick = snapshot.tick;
  return result;
}

export function pruneSnapshotClients(sim: SimState): void {
  for (const id of sim.snapshotClients.keys()) {
    const slot = sim.players.get(id);
    if (!slot?.connected) sim.snapshotClients.delete(id);
  }
}
