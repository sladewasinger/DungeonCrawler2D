import {
  containsPoint,
  miniBossArenaAtGate,
  type MiniBossArenaGate,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import { teleportPlayer } from "../../actions/playerTeleport.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import {
  miniBossArenaOccupants,
  occupyMiniBossArena,
} from "./runtime.js";
import {
  miniBossEncounterAlive,
  spawnMiniBossEncounter,
} from "./population.js";

interface GateInteraction {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly gate: { readonly x: number; readonly y: number };
}

interface ArenaCrossing {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly arena: MiniBossArenaSite;
  readonly gate: MiniBossArenaGate;
}

export function useMiniBossArenaGate(
  input: GateInteraction,
): boolean {
  const { sim, slot, gate: target } = input;
  const arena = miniBossArenaAtGate(sim.world, target.x, target.y);
  const gate = arena?.gates.find(({ x, y }) =>
    x === target.x && y === target.y
  );
  if (!arena || !gate) return false;
  const crossing = { sim, slot, arena, gate };
  if (sim.defeatedMiniBossArenas.has(arena.key)) {
    teleportThroughOpenGate(crossing);
    return true;
  }
  ensureEncounter(sim, arena);
  if (!miniBossEncounterAlive(sim, arena.key)) {
    notify(slot, "The arena gate refuses to open.");
    return true;
  }
  return enterArena(crossing);
}

function enterArena(input: ArenaCrossing): true {
  const { sim, slot, arena, gate } = input;
  const occupants = miniBossArenaOccupants(sim, arena.key);
  if (occupants.has(slot.entity.id)) {
    notify(slot, "The gate stays sealed until the arena is cleared.");
    return true;
  }
  if (occupants.size > 0) {
    notify(slot, "The arena is sealed. Someone else is fighting.");
    return true;
  }
  occupyMiniBossArena(sim, arena.key, slot.entity.id);
  teleportPlayer({ sim, slot, to: gate.inside, remember: false });
  notify(slot, "The gate slams shut. Defeat the warlord and its guards.");
  return true;
}

function teleportThroughOpenGate(input: ArenaCrossing): void {
  const { sim, slot, arena, gate } = input;
  const body = slot.entity.body;
  const inside = containsPoint(arena.interior, body.x, body.y);
  teleportPlayer({
    sim,
    slot,
    to: inside ? gate.outside : gate.inside,
    remember: false,
  });
}

function ensureEncounter(sim: SimState, arena: MiniBossArenaSite): void {
  if (miniBossEncounterAlive(sim, arena.key)) return;
  spawnMiniBossEncounter(sim, arena.chunk.cx, arena.chunk.cy);
}

function notify(slot: PlayerSlot, msg: string): void {
  slot.outbox.push({ t: "toast", msg });
}
