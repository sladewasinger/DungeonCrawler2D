import {
  CHUNK_SIZE,
  containsPoint,
  miniBossArenaIsStamped,
  miniBossArenaForChunk,
  type MiniBossArenaGate,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import { syncWorldFeatureOverrides } from "../../core/worldFeatureOverrides.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import {
  applyArenaAuthoritativePosition,
  stepMiniBossArenaEntries,
} from "./entryStep.js";
import {
  clearMiniBossArena,
  miniBossArenaEntryForArena,
  miniBossArenaEntryForPlayer,
  miniBossArenaOccupants,
  removeMiniBossArenaPlayer,
} from "./runtime.js";

export function stepMiniBossArenaBoundaries(sim: SimState): void {
  const removedOpenGate = removeInactiveArenaPlayers(sim);
  const entryGateChanged = stepMiniBossArenaEntries(sim);
  if (removedOpenGate || entryGateChanged) syncWorldFeatureOverrides(sim);
  for (const slot of sim.players.values()) {
    if (isTrackedArenaPlayer(slot)) enforcePlayerBoundary(sim, slot);
  }
}

function removeInactiveArenaPlayers(sim: SimState): boolean {
  let gateChanged = false;
  for (const slot of sim.players.values()) {
    if (isTrackedArenaPlayer(slot)) {
      if (!canContinueEntry(slot) &&
          miniBossArenaEntryForPlayer(sim, slot.entity.id)) {
        gateChanged = removeMiniBossArenaPlayer(sim, slot.entity.id) ||
          gateChanged;
      }
      continue;
    }
    gateChanged = removeMiniBossArenaPlayer(sim, slot.entity.id) || gateChanged;
  }
  return gateChanged;
}

function isTrackedArenaPlayer(slot: PlayerSlot): boolean {
  return slot.connected && slot.entity.hp > 0 &&
    slot.respawnAtTick === null;
}

function canContinueEntry(slot: PlayerSlot): boolean {
  return isTrackedArenaPlayer(slot) && slot.downedAtTick === null;
}

function enforcePlayerBoundary(sim: SimState, slot: PlayerSlot): void {
  if (miniBossArenaEntryForPlayer(sim, slot.entity.id)) return;
  for (const arena of nearbyArenas(sim, slot.entity.body)) {
    if (sim.defeatedMiniBossArenas.has(arena.key)) {
      clearMiniBossArena(sim, arena.key);
      continue;
    }
    enforceArenaBoundary({ sim, slot, arena });
  }
}

interface BoundaryCheck {
  readonly sim: SimState;
  readonly slot: PlayerSlot;
  readonly arena: MiniBossArenaSite;
}

function enforceArenaBoundary(input: BoundaryCheck): void {
  const { sim, slot, arena } = input;
  const occupants = miniBossArenaOccupants(sim, arena.key);
  const occupant = occupants.has(slot.entity.id);
  const body = slot.entity.body;
  const inside = containsPoint(arena.interior, body.x, body.y);
  if (occupant === inside) return;
  const gate = nearestGate(arena, body);
  const target = occupant ? gate.inside : gate.outside;
  applyArenaAuthoritativePosition({
    sim,
    slot,
    position: target,
    before: { x: body.x, y: body.y },
  });
}

function nearbyArenas(
  sim: SimState,
  body: { readonly x: number; readonly y: number },
): MiniBossArenaSite[] {
  const cx = Math.floor(body.x / CHUNK_SIZE);
  const cy = Math.floor(body.y / CHUNK_SIZE);
  const arenas: MiniBossArenaSite[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const arena = miniBossArenaForChunk({
        worldSeed: sim.world.worldSeed,
        floor: sim.world.floor,
        cx: cx + dx,
        cy: cy + dy,
      });
      if (arena && arenaBoundaryIsActive(sim, arena)) {
        arenas.push(arena);
      }
    }
  }
  return arenas;
}

function arenaBoundaryIsActive(
  sim: SimState,
  arena: MiniBossArenaSite,
): boolean {
  return miniBossArenaIsStamped(sim.world, arena) ||
    miniBossArenaEntryForArena(sim, arena.key) !== undefined;
}

function nearestGate(
  arena: MiniBossArenaSite,
  point: { readonly x: number; readonly y: number },
): MiniBossArenaGate {
  return arena.gates.reduce((nearest, gate) =>
    distanceSquared(gate, point) < distanceSquared(nearest, point)
      ? gate
      : nearest
  );
}

function distanceSquared(
  gate: Pick<MiniBossArenaGate, "x" | "y">,
  point: { readonly x: number; readonly y: number },
): number {
  return (gate.x + 0.5 - point.x) ** 2 +
    (gate.y + 0.5 - point.y) ** 2;
}
