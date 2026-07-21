import { createBody, stairwayDownPosition, stairwayUpPosition } from "@dc2d/engine";
import { announceFloorEntry, announceStairwayHint } from "../announcer/index.js";
import { respawnSlot } from "../players.js";
import { leaveParty } from "../social.js";
import { findSpawn } from "../spawn.js";
import type { FloorTransferRequest, SimState } from "../state.js";

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
    sim.outgoingTransfers.push({ slot, ...transfer });
  }
}

/** Place an arriving slot into `sim` (the destination) and resolve its
 * landing spot per `req.arrival`. */
export function receiveTransfer(sim: SimState, req: FloorTransferRequest): void {
  const { slot } = req;
  sim.players.set(slot.entity.id, slot);
  sim.byToken.set(slot.resumeToken, slot.entity.id);
  slot.known.clear();
  slot.needsFullAreas = true;
  slot.pendingInputs.length = 0;

  if (req.arrival === "deathSpawn") {
    // Full reset (hp/body/statuses/starter-kit) at THIS sim's own spawn —
    // same machinery every floor-1 in-place death already used.
    respawnSlot(sim, slot);
  } else {
    const landing =
      (req.arrival === "stairUp" ? stairwayUpPosition(sim.world) : stairwayDownPosition(sim.world)) ??
      null;
    const target = landing ? { ...landing, z: sim.world.groundAt(landing.x, landing.y) } : findSpawn(sim);
    slot.entity.body = createBody(target.x, target.y, target.z);
    slot.outbox.push({ t: "teleported" });
  }
  slot.outbox.push(announceFloorEntry(sim.world.floor));
  // LANE W (panel R3 blocker #2): the stairway-exists hint rides right behind the
  // floor identity line on every arrival — null (skipped) on FLOOR_CAP's boss floor.
  const stairHint = announceStairwayHint(sim.tickCount, slot.entity.id, sim.world);
  if (stairHint) slot.outbox.push(stairHint);
  sim.store.recordDeepestFloor(slot.stored, sim.world.floor);
}
