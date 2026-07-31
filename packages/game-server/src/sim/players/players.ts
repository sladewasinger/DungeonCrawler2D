import {
  PLAYER_MAX_HP,
  PLAYER_MAX_STAMINA,
  RECONNECT_GRACE_MS,
  TICK_RATE,
  createBody,
  type EffectEvent,
} from "@dc2d/engine";
import { grantRespawnKit } from "../inventory/inventory.js";
import { findPlayerSpawn } from "../spawn/playerSpawn.js";
import { secureSpawnHandoff } from "../spawnSafety/spawnSafety.js";
import { leaveParty } from "../social/social.js";
import { miniBossArenaEntryForPlayer } from "../enemies/miniBossArena/runtime.js";
import { clearActiveMeleeAttack } from "../state/meleeAttackState.js";
import type { PlayerSlot, SimState } from "../state/state.js";
import {
  resetInputTimeline,
  suppressInputTimeline,
} from "./playerInputTimeline.js";
import { stepPlayerBody } from "./step.js";

/** Player step/lifecycle after join: input handling, movement, reap/respawn. Join/resume live in join.ts. */

export { handleInput } from "./playerInputTimeline.js";

const GRACE_TICKS = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);

export function markDisconnected(sim: SimState, playerId: string): void {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected) return;
  slot.connected = false;
  slot.disconnectedAtTick = sim.tickCount;
  resetInputTimeline(slot);
  slot.pendingActions.length = 0;
  slot.blocking = false;
  clearActiveMeleeAttack(slot);
  slot.reapAtTick = sim.tickCount + GRACE_TICKS;
}

export function queueAction(
  sim: SimState,
  playerId: string,
  msg: PlayerSlot["pendingActions"][number],
): boolean {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected) return false;
  if (slot.entity.hp <= 0 && msg.type !== "rescue") return false;
  if (slot.pendingActions.length >= 16) return false;
  slot.pendingActions.push(msg);
  return true;
}

/** Reap grace-expired disconnects; respawn dead players whose timer elapsed. */
export function reapAndRespawn(sim: SimState): void {
  for (const [id, slot] of sim.players) {
    if (reapDisconnectedPlayer(sim, id, slot)) continue;
    respawnDuePlayer(sim, slot);
  }
}

function reapDisconnectedPlayer(sim: SimState, id: string, slot: PlayerSlot): boolean {
  if (slot.connected || sim.tickCount < slot.reapAtTick) return false;
  leaveParty(sim, slot);
  sim.players.delete(id);
  sim.byToken.delete(slot.resumeToken);
  return true;
}

function respawnDuePlayer(sim: SimState, slot: PlayerSlot): void {
  if (!slot.connected || slot.respawnAtTick === null || sim.tickCount < slot.respawnAtTick) return;
  slot.respawnAtTick = null;
  if (sim.world.floor === 1) respawnSlot(sim, slot);
  else slot.pendingTransfer = { targetFloor: 1, arrival: "deathSpawn" };
}

/** Reset a dead connected slot after its authoritative respawn delay elapses. */
export function respawnSlot(sim: SimState, slot: PlayerSlot): void {
  sim.store.recordActiveFloor(slot.stored, sim.world.floor);
  slot.respawnAtTick = null;
  const spawn = findPlayerSpawn(sim, slot.stored.slot);
  slot.entity.body = createBody(spawn.x, spawn.y, spawn.z);
  slot.entity.hp = PLAYER_MAX_HP;
  slot.maxStamina ??= PLAYER_MAX_STAMINA;
  slot.stamina = slot.maxStamina;
  slot.blocking = false;
  resetInputTimeline(slot);
  slot.staminaRecoveryDelaySeconds = 0;
  slot.staminaExhausted = false;
  slot.lastDamageAtTick = sim.tickCount;
  slot.lastDamagedByPlayerId = null;
  slot.entity.statuses = [];
  slot.downedAtTick = null;
  slot.forceDeath = false;
  delete slot.entity.downedUntil;
  slot.returnStack = [];
  slot.needsFullAreas = true;
  slot.outbox.push({ t: "teleported" }, { t: "toast", msg: "You wake up somewhere else…" });
  // Panel round 3b blocker #1: death must never respawn into the same
  // ambush — clear the entry tile's neighborhood + grant spawn grace.
  secureSpawnHandoff(sim, slot);
  // Panel round 4 (BookFan: respawned UNARMED): the kit re-grant is
  // unconditional on respawn — sword equipped + torch stack, exactly
  // like a fresh join. See inventory.ts's grantRespawnKit doc.
  grantRespawnKit(sim, slot);
}

export function stepPlayers(sim: SimState, effectEvents: EffectEvent[]): void {
  for (const slot of sim.players.values()) {
    sim.replicationMotion.set(slot.entity.id, { x: 0, y: 0 });
    if (!slot.connected) {
      resetInputTimeline(slot);
      continue;
    }
    if (slot.entity.hp <= 0 || slot.downedAtTick !== null) {
      slot.blocking = false;
      resetInputTimeline(slot);
      continue;
    }
    if (miniBossArenaEntryForPlayer(sim, slot.entity.id)) {
      slot.blocking = false;
      suppressInputTimeline(slot);
      continue;
    }
    stepPlayerBody({ sim, slot, effectEvents });
  }
}

/**
 * Dev-harness god mode: whatever the tick did to a god player, undo it
 * before deaths resolve — full heal, stamina restored by the resource step,
 * statuses stripped, knockback zeroed. One choke point instead of guards in
 * every damage path.
 */
export function applyGodMode(sim: SimState): void {
  for (const slot of sim.players.values()) {
    if (!slot.god) continue;
    slot.entity.hp = slot.entity.maxHp;
    slot.entity.statuses = [];
    slot.entity.body.kx = 0;
    slot.entity.body.ky = 0;
    slot.downedAtTick = null;
    delete slot.entity.downedUntil;
  }
}
