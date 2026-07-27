import {
  FALL_DAMAGE_PER_UNIT,
  NEUTRAL_INPUT,
  PLAYER_MAX_HP,
  PLAYER_MAX_STAMINA,
  RECONNECT_GRACE_MS,
  SAFE_FALL_HEIGHT,
  TICK_DT,
  TICK_RATE,
  createBody,
  faceEntity,
  stepBody,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import { killIfInChasm } from "./deaths.js";
import { effectTargetFor } from "./helpers.js";
import { advancePlayerResources } from "./combatResources.js";
import { grantRespawnKit } from "./inventory.js";
import { findSpawn } from "./spawn.js";
import { endSpawnGrace, secureSpawnHandoff } from "./spawnSafety.js";
import { leaveParty } from "./social.js";
import type { PlayerSlot, SimState } from "./state.js";
import { advanceInputTimeline, resetInputTimeline } from "./playerInputTimeline.js";

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
  slot.reapAtTick = sim.tickCount + GRACE_TICKS;
}

export function queueAction(
  sim: SimState,
  playerId: string,
  msg: PlayerSlot["pendingActions"][number],
): void {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected || slot.entity.hp <= 0) return;
  if (slot.pendingActions.length < 16) slot.pendingActions.push(msg);
}

/** Reap grace-expired disconnects; respawn dead players whose timer elapsed. */
export function reapAndRespawn(sim: SimState): void {
  for (const [id, slot] of sim.players) {
    if (!slot.connected && sim.tickCount >= slot.reapAtTick) {
      // dropAllInventory(sim, slot); // Don't drop items for disconnected players; only deaths.
      leaveParty(sim, slot);
      sim.players.delete(id);
      sim.byToken.delete(slot.resumeToken);
      continue;
    }
    if (!slot.connected) continue;
    if (slot.respawnAtTick === null || sim.tickCount < slot.respawnAtTick) continue;
    slot.respawnAtTick = null;
    // Epic 7.14 (The Descent): death always returns you to floor 1
    // (docs/ROADMAP.md's design call, logged as ASSUMPTION #7 pre-dates
    // this wave) — in place if already there, else a cross-sim transfer
    // to floor 1's spawn (floors/transfer.ts handles the reset).
    if (sim.world.floor === 1) respawnSlot(sim, slot);
    else slot.pendingTransfer = { targetFloor: 1, arrival: "deathSpawn" };
  }
}

/** Reset a dead connected slot after its authoritative respawn delay elapses. */
export function respawnSlot(sim: SimState, slot: PlayerSlot): void {
  sim.store.recordActiveFloor(slot.stored, sim.world.floor);
  slot.respawnAtTick = null;
  const spawn = findSpawn(sim);
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
    const entity = slot.entity;
    if (entity.hp <= 0 || slot.downedAtTick !== null) {
      slot.blocking = false;
      resetInputTimeline(slot);
      continue;
    }
    stepPlayerBody(sim, slot, entity, effectEvents);
  }
}

/** Advances every body once with the control state due on its client simulation timeline. */
function stepPlayerBody(
  sim: SimState,
  slot: PlayerSlot,
  entity: Entity,
  effectEvents: EffectEvent[],
): void {
  const tags = sim.effects.tagsOf(entity);
  const opts = { speed: entity.baseSpeed * sim.effects.speedMult(entity), stickyFeet: tags.has("sticky-feet") };
  const input = advancePlayerResources(slot, advanceInputTimeline(slot) ?? NEUTRAL_INPUT);
  if (input.moveX !== 0 || input.moveY !== 0 || input.jump) endSpawnGrace(slot);
  faceEntity(entity, input.faceX ?? input.moveX, input.faceY ?? input.moveY);
  const beforeX = entity.body.x;
  const beforeY = entity.body.y;
  const result = stepBody(sim.world, entity.body, input, TICK_DT, opts);
  sim.replicationMotion.set(entity.id, {
    x: (entity.body.x - beforeX) / TICK_DT,
    y: (entity.body.y - beforeY) / TICK_DT,
  });
  if (result.landed) handleLanding(sim, entity, result.landed.fallHeight, tags, effectEvents);
  killIfInChasm(slot);
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

function handleLanding(
  sim: SimState,
  entity: Entity,
  fallHeight: number,
  tags: Set<string>,
  effectEvents: EffectEvent[],
): void {
  if (fallHeight <= SAFE_FALL_HEIGHT) return;
  if (tags.has("feather-fall")) return;
  // Landing in liquid (wet/oil pools) breaks the fall.
  if (sim.areas.hasTagAt(Math.floor(entity.body.x), Math.floor(entity.body.y), "liquid")) return;
  const damage = -(fallHeight - SAFE_FALL_HEIGHT) * FALL_DAMAGE_PER_UNIT;
  sim.effects.modifyHealth(
    entity,
    damage,
    effectEvents,
    { sourceTags: ["fall"] },
    // Keep the pre-existing fall-damage behavior during spawn grace while
    // still applying any durable handicap grant.
    effectTargetFor(sim, entity, { spawnProtection: false }),
  );
}
