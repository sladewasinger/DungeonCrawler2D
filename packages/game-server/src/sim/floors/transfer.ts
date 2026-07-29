import { createBody, stairwayUpPosition } from "@dc2d/engine";
import { announceFloorEntry, announceStairwayHint } from "../announcer/index.js";
import { respawnSlot } from "../players/players.js";
import { refreshModerationBindings } from "../moderation.js";
import { resetInputTimeline } from "../players/playerInputTimeline.js";
import { leaveParty } from "../social/social.js";
import { findSpawn } from "../spawn/spawn.js";
import { clearPetPath } from "../pets/index.js";
import type { FloorTransferRequest, SimState } from "../state/state.js";

/**
 * Cross-sim slot transfer (Epic 7.14): the same PlayerSlot object moves
 * between two SimState instances' `players`/`byToken` maps — no new
 * entity, no inventory/hotbar/weapon copy, xp rides the process-global
 * PlayerStore untouched. Two halves: `drainReadyTransfers` removes a
 * departing slot from its SOURCE sim (called at the tail of every
 * GameSim.step()); `receiveTransfer` inserts it into its DESTINATION
 * sim (called by FloorRegistry once that sim exists). Parties are
 * tracked per-floor-sim (ASSUMPTION #132, docs/ASSUMPTIONS.md), so a
 * transferring player always leaves their party first.
 */

/** Remove every slot whose `pendingTransfer` was set this tick from
 * `sim`, queuing a request for FloorRegistry to place next tick. */
export function drainReadyTransfers(sim: SimState): void {
  for (const [id, slot] of sim.players) {
    const transfer = slot.pendingTransfer;
    if (!transfer) continue;
    slot.pendingTransfer = null;
    leaveParty(sim, slot);
    sim.players.delete(id);
    sim.byToken.delete(slot.resumeToken);
    const pets = [...sim.pets.values()].filter((pet) => pet.ownerId === id);
    for (const pet of pets) sim.pets.delete(pet.entity.id);
    sim.outgoingTransfers.push({ slot, pets, ...transfer });
  }
}

/** Place an arriving slot into `sim` (the destination) and resolve its
 * landing spot per `req.arrival`. */
export function receiveTransfer(sim: SimState, req: FloorTransferRequest): void {
  establishTransfer(sim, req);
  placeTransferredPlayer(sim, req);
  placeTransferredPets(sim, req);
  announceArrival(sim, req);
}

function establishTransfer(sim: SimState, req: FloorTransferRequest): void {
  const { slot } = req;
  sim.players.set(slot.entity.id, slot);
  sim.byToken.set(slot.resumeToken, slot.entity.id);
  for (const pet of req.pets) sim.pets.set(pet.entity.id, pet);
  refreshModerationBindings(sim);
  slot.known.clear();
  slot.needsFullAreas = true;
  resetInputTimeline(slot);
}

function placeTransferredPlayer(sim: SimState, req: FloorTransferRequest): void {
  const { slot } = req;
  if (req.arrival === "deathSpawn") {
    // Full reset (hp/body/statuses/starter-kit) at THIS sim's own spawn —
    // same machinery every floor-1 in-place death already used.
    respawnSlot(sim, slot);
  } else {
    const landing = stairwayUpPosition(sim.world);
    const target = landing ? { ...landing, z: sim.world.groundAt(landing.x, landing.y) } : findSpawn(sim);
    slot.entity.body = createBody(target.x, target.y, target.z);
    slot.outbox.push({ t: "teleported" });
  }
}

function placeTransferredPets(sim: SimState, req: FloorTransferRequest): void {
  const { slot } = req;
  for (const pet of req.pets) {
    const x = slot.entity.body.x - 1;
    const y = slot.entity.body.y;
    pet.entity.body = createBody(x, y, sim.world.groundAt(x, y));
    pet.lastOwnerPosition = { x: slot.entity.body.x, y: slot.entity.body.y };
    pet.driftTarget = undefined;
    clearPetPath(pet);
  }
}

function announceArrival(sim: SimState, req: FloorTransferRequest): void {
  const { slot } = req;
  slot.outbox.push(announceFloorEntry(sim.world.floor));
  // LANE W (panel R3 blocker #2): the stairway-exists hint rides right behind the
  // floor identity line on every arrival — null (skipped) on FLOOR_CAP's boss floor.
  const stairHint = announceStairwayHint(sim.tickCount, slot.entity.id, sim.world);
  if (stairHint) slot.outbox.push(stairHint);
  sim.store.recordFloor(slot.stored, sim.world.floor);
}
