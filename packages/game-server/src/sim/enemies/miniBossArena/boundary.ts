import {
  CHUNK_SIZE,
  containsPoint,
  miniBossArenaIsStamped,
  miniBossArenaForChunk,
  type MiniBossArenaGate,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import { teleportPlayer } from "../../actions/playerTeleport.js";
import type { PlayerSlot, SimState } from "../../state/state.js";
import {
  clearMiniBossArena,
  miniBossArenaOccupants,
  removeMiniBossArenaPlayer,
} from "./runtime.js";

export function stepMiniBossArenaBoundaries(sim: SimState): void {
  removeInactiveOccupants(sim);
  for (const slot of sim.players.values()) {
    if (isActivePlayer(slot)) enforcePlayerBoundary(sim, slot);
  }
}

function removeInactiveOccupants(sim: SimState): void {
  for (const slot of sim.players.values()) {
    if (hasLiveArenaBody(slot)) continue;
    removeMiniBossArenaPlayer(sim, slot.entity.id);
  }
}

function isActivePlayer(slot: PlayerSlot): boolean {
  return hasLiveArenaBody(slot);
}

function hasLiveArenaBody(slot: PlayerSlot): boolean {
  return slot.connected && slot.entity.hp > 0 &&
    slot.respawnAtTick === null;
}

function enforcePlayerBoundary(sim: SimState, slot: PlayerSlot): void {
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
  teleportPlayer({
    sim,
    slot,
    to: occupant ? gate.inside : gate.outside,
    remember: false,
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
      if (arena && miniBossArenaIsStamped(sim.world, arena)) {
        arenas.push(arena);
      }
    }
  }
  return arenas;
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
