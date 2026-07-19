import {
  FALL_DAMAGE_PER_UNIT,
  HOTBAR_SLOTS,
  MAX_INPUTS_PER_TICK,
  NEUTRAL_INPUT,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_MS,
  SAFE_FALL_HEIGHT,
  TICK_DT,
  TICK_RATE,
  createBody,
  faceEntity,
  makeEntity,
  newEntityId,
  stepBody,
  type ClientInput,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import { dropAllInventory } from "./inventory.js";
import { leaveParty } from "./social.js";
import { findSpawn, newToken } from "./spawn.js";
import type { JoinResult, PlayerSlot, SimState } from "./state.js";

/** Player lifecycle (join/resume/reap/respawn) and predicted movement. */

const GRACE_TICKS = Math.ceil((RECONNECT_GRACE_MS / 1000) * TICK_RATE);

export function addPlayer(
  sim: SimState,
  name: string,
  clientId: string,
  resumeToken?: string,
): JoinResult {
  if (resumeToken) {
    const resumed = tryResume(sim, resumeToken, clientId);
    if (resumed) return resumed;
  }

  const spawn = findSpawn(sim);
  const entity = makeEntity("player", createBody(spawn.x, spawn.y, spawn.z), {
    id: newEntityId("p"),
    name,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    baseSpeed: 8,
    tags: new Set(["player", "organic"]),
    facing: { x: 0, y: 1 },
  });
  const token = newToken(sim);
  const slot = newSlot(entity, clientId, sim.store.get(clientId, name), token);
  sim.players.set(entity.id, slot);
  sim.byToken.set(token, entity.id);
  return { playerId: entity.id, resumeToken: token, spawn, resumed: false };
}

/** Default bookkeeping for a freshly-joined player. */
function newSlot(
  entity: Entity,
  clientId: string,
  stored: PlayerSlot["stored"],
  resumeToken: string,
): PlayerSlot {
  return {
    entity,
    clientId,
    stored,
    resumeToken,
    lastSeq: -1,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER,
    known: new Set(),
    inventory: [],
    hotbar: Array(HOTBAR_SLOTS).fill(null),
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false,
    forceDeath: false,
  };
}

/** Reattach a disconnected slot to a reconnecting client, if the token still owns one. */
function tryResume(sim: SimState, resumeToken: string, clientId: string): JoinResult | null {
  const existingId = sim.byToken.get(resumeToken);
  const slot = existingId ? sim.players.get(existingId) : undefined;
  if (!slot || slot.connected || slot.clientId !== clientId) return null;
  slot.connected = true;
  slot.pendingInputs.length = 0;
  slot.pendingActions.length = 0;
  slot.lastSeq = -1;
  slot.needsFullAreas = true;
  return {
    playerId: slot.entity.id,
    resumeToken: slot.resumeToken,
    spawn: { x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z },
    resumed: true,
  };
}

export function markDisconnected(sim: SimState, playerId: string): void {
  const slot = sim.players.get(playerId);
  if (!slot) return;
  slot.connected = false;
  slot.reapAtTick = sim.tickCount + GRACE_TICKS;
}

export function handleInput(sim: SimState, playerId: string, input: ClientInput): void {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected || slot.entity.hp <= 0 || slot.downedAtTick !== null) return;
  if (input.seq <= slot.lastSeq) return;
  slot.pendingInputs.push(input);
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
    if (slot.respawnAtTick !== null && sim.tickCount >= slot.respawnAtTick) respawnSlot(sim, slot);
  }
}

/** Reset a dead slot to a fresh body/HP at a new spawn point. */
function respawnSlot(sim: SimState, slot: PlayerSlot): void {
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

/** Consume this tick's queued inputs (or coast on neutral input) and resolve landings. */
function stepPlayerBody(
  sim: SimState,
  slot: PlayerSlot,
  entity: Entity,
  effectEvents: EffectEvent[],
): void {
  const tags = sim.effects.tagsOf(entity);
  const opts = { speed: entity.baseSpeed * sim.effects.speedMult(entity), stickyFeet: tags.has("sticky-feet") };
  const inputs = slot.pendingInputs.splice(0, MAX_INPUTS_PER_TICK);
  slot.pendingInputs.length = 0;
  if (inputs.length === 0) {
    const result = stepBody(sim.world, entity.body, NEUTRAL_INPUT, TICK_DT, opts);
    if (result.landed) handleLanding(sim, entity, result.landed.fallHeight, tags, effectEvents);
    return;
  }
  for (const input of inputs) {
    faceEntity(entity, input.moveX, input.moveY);
    const result = stepBody(sim.world, entity.body, input, TICK_DT, opts);
    slot.lastSeq = input.seq;
    if (result.landed) handleLanding(sim, entity, result.landed.fallHeight, tags, effectEvents);
  }
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
