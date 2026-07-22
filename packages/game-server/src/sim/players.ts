import {
  FALL_DAMAGE_PER_UNIT,
  NEUTRAL_INPUT,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_MS,
  SAFE_FALL_HEIGHT,
  TICK_DT,
  TICK_RATE,
  createBody,
  faceEntity,
  stepBody,
  type ClientInput,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import { killIfInChasm } from "./deaths.js";
import { dropAllInventory, grantRespawnKit } from "./inventory.js";
import { findSpawn } from "./spawn.js";
import { endSpawnGrace, secureSpawnHandoff } from "./spawnSafety.js";
import { leaveParty } from "./social.js";
import type { PlayerSlot, SimState } from "./state.js";

/** Player step/lifecycle after join: input handling, movement, reap/respawn. Join/resume live in join.ts. */

const GRACE_TICKS = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);

export function markDisconnected(sim: SimState, playerId: string): void {
  const slot = sim.players.get(playerId);
  if (!slot) return;
  slot.connected = false;
  slot.pendingInputs.length = 0;
  slot.reapAtTick = sim.tickCount + GRACE_TICKS;
}

export function handleInput(sim: SimState, playerId: string, input: ClientInput): void {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected || slot.entity.hp <= 0 || slot.downedAtTick !== null) return;
  if (input.seq <= slot.lastSeq) return;
  slot.pendingInputs[0] = input;
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
      dropAllInventory(sim, slot);
      leaveParty(sim, slot);
      sim.players.delete(id);
      sim.byToken.delete(slot.resumeToken);
      continue;
    }
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

/** Reset a dead slot to a fresh body/HP at a new spawn point. Exported
 * for join.ts, which must never resume a reconnecting client into a
 * body that's still dead (Epic 7.13 join-death fix) — same reset, same
 * starter-kit safety net, whichever caller triggers it. */
export function respawnSlot(sim: SimState, slot: PlayerSlot): void {
  slot.respawnAtTick = null;
  const spawn = findSpawn(sim);
  slot.entity.body = createBody(spawn.x, spawn.y, spawn.z);
  slot.entity.hp = PLAYER_MAX_HP;
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
    const entity = slot.entity;
    if (entity.hp <= 0 || slot.downedAtTick !== null) {
      slot.pendingInputs.length = 0;
      continue;
    }
    stepPlayerBody(sim, slot, entity, effectEvents);
  }
}

/** Advances every body once with its newest held control state. */
function stepPlayerBody(
  sim: SimState,
  slot: PlayerSlot,
  entity: Entity,
  effectEvents: EffectEvent[],
): void {
  const tags = sim.effects.tagsOf(entity);
  const opts = { speed: entity.baseSpeed * sim.effects.speedMult(entity), stickyFeet: tags.has("sticky-feet") };
  const latestInput = slot.pendingInputs[0];
  const input = latestInput ?? NEUTRAL_INPUT;
  if (input.moveX !== 0 || input.moveY !== 0 || input.jump) endSpawnGrace(slot);
  faceEntity(entity, input.faceX ?? input.moveX, input.faceY ?? input.moveY);
  const result = stepBody(sim.world, entity.body, input, TICK_DT, opts);
  if (latestInput) slot.lastSeq = latestInput.seq;
  if (result.landed) handleLanding(sim, entity, result.landed.fallHeight, tags, effectEvents);
  killIfInChasm(slot);
}

/**
 * Dev-harness god mode: whatever the tick did to a god player, undo it
 * before deaths resolve — full heal, statuses stripped, knockback
 * zeroed. One choke point instead of guards in every damage path.
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
  sim.effects.modifyHealth(entity, damage, effectEvents, { sourceTags: ["fall"] });
}
