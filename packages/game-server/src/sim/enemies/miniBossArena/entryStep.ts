import type { PlayerSlot, SimState } from "../../state/state.js";
import { MINI_BOSS_ARENA_RUNTIME_CONFIGURATION as CONFIG } from "./configuration.js";
import { advanceArenaEntry } from "./entryMotion.js";
import {
  completeMiniBossArenaEntry,
  miniBossArenaEntries,
  type MiniBossArenaEntry,
} from "./runtime.js";

interface AuthoritativePositionUpdate {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly position: { readonly x: number; readonly y: number };
  readonly before: { readonly x: number; readonly y: number };
}

export function stepMiniBossArenaEntries(sim: SimState): boolean {
  let gateChanged = false;
  for (const entry of miniBossArenaEntries(sim)) {
    const slot = sim.players.get(entry.playerId);
    if (!slot || !canContinueEntry(slot)) continue;
    gateChanged = stepArenaEntry(sim, slot, entry) || gateChanged;
  }
  return gateChanged;
}

export function applyArenaAuthoritativePosition(
  input: AuthoritativePositionUpdate,
): void {
  const { sim, slot, position, before } = input;
  const body = slot.entity.body;
  body.x = position.x;
  body.y = position.y;
  body.kx = 0;
  body.ky = 0;
  const dt = CONFIG.simulationTickSeconds;
  sim.replicationMotion.set(slot.entity.id, {
    x: (body.x - before.x) / dt,
    y: (body.y - before.y) / dt,
  });
}

function stepArenaEntry(
  sim: SimState,
  slot: PlayerSlot,
  entry: MiniBossArenaEntry,
): boolean {
  const body = slot.entity.body;
  const before = { x: body.x, y: body.y };
  const progress = advanceArenaEntry(before, entry.gate, entry.waypointIndex);
  entry.waypointIndex = progress.waypointIndex;
  applyArenaAuthoritativePosition({
    sim,
    slot,
    position: progress.position,
    before,
  });
  if (!progress.complete) return false;
  completeMiniBossArenaEntry(sim, entry.arenaKey);
  notifyEntryComplete(slot);
  return true;
}

function canContinueEntry(slot: PlayerSlot): boolean {
  return slot.connected && slot.entity.hp > 0 &&
    slot.respawnAtTick === null && slot.downedAtTick === null;
}

function notifyEntryComplete(slot: PlayerSlot): void {
  slot.outbox.push({
    t: "toast",
    msg: "The gate slams shut. Defeat the warlord and its guards.",
  });
}
