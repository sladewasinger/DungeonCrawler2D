import {
  MOVE_SPEED,
  PLAYER_MAX_HP,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
  type PlayerSkin,
} from "@dc2d/engine";
import { announceFloorEntry, announceJoin, announceStairwayHint, broadcastAnnouncement } from "../announcer/index.js";
import { sendContactsUpdated } from "../combat/contacts.js";
import { ensureStarterKit } from "../inventory/inventory.js";
import { refreshModerationBindings, sendModerationState } from "../moderation.js";
import { replayPartyInviteState } from "../social/partyInviteEvents.js";
import { resetInputTimeline } from "./playerInputTimeline.js";
import { findPlayerSpawn } from "../spawn/playerSpawn.js";
import { newToken } from "../spawn/spawn.js";
import { secureSpawnHandoff } from "../spawnSafety/spawnSafety.js";
import { createPlayerSlot } from "./joinSlot.js";
import { restorePausedLifecycle } from "./joinResume.js";
import { handicapForPlayer } from "../progression/handicap.js";
import type { JoinResult, PlayerSlot, SimState } from "../state/state.js";

export interface PlayerJoinRequest {
  name: string;
  clientId: string;
  resumeToken?: string | undefined;
  skin?: PlayerSkin | undefined;
}

/** Player join and reconnect-resume: the entity/slot a fresh or returning client gets. */
export function addPlayer(sim: SimState, request: PlayerJoinRequest): JoinResult {
  return resumePlayer(sim, request) ?? createPlayer(sim, request);
}

function resumePlayer(sim: SimState, request: PlayerJoinRequest): JoinResult | null {
  if (request.resumeToken) {
    const resumed = tryResume(sim, request);
    if (resumed) return resumed;
  }
  return reclaimExistingClient(sim, request);
}

function createPlayer(sim: SimState, request: PlayerJoinRequest): JoinResult {
  const spawn = findPlayerSpawn(sim, sim.players.size);
  const entity = createPlayerEntity(request.name, spawn, request.skin);
  const token = newToken(sim);
  const slot = createPlayerSlot({
    entity,
    clientId: request.clientId,
    stored: sim.store.get(request.clientId, request.name),
    resumeToken: token,
    tick: sim.tickCount,
  });
  sim.players.set(entity.id, slot);
  sim.byToken.set(token, entity.id);
  completeFreshJoin(sim, slot, request.name);
  return { playerId: entity.id, resumeToken: token, spawn, resumed: false, floor: sim.world.floor };
}

function createPlayerEntity(
  name: string,
  spawn: { x: number; y: number; z: number },
  skin?: PlayerSkin,
): Entity {
  return makeEntity("player", createBody(spawn.x, spawn.y, spawn.z), {
    id: newEntityId("p"),
    name,
    ...(skin ? { skin } : {}),
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    baseSpeed: MOVE_SPEED,
    tags: new Set(["player", "organic"]),
    facing: { x: 0, y: 1 },
  });
}

function completeFreshJoin(sim: SimState, slot: PlayerSlot, name: string): void {
  secureSpawnHandoff(sim, slot);
  ensureStarterKit(sim, slot);
  syncModerationState(sim, slot);
  sendContactsUpdated(sim, slot);
  announceFreshJoin(sim, slot, name);
  slot.outbox.push(announceFloorEntry(sim.world.floor));
  const stairHint = announceStairwayHint(sim.tickCount, slot.entity.id, sim.world);
  if (stairHint) slot.outbox.push(stairHint);
  sim.store.recordFloor(slot.stored, sim.world.floor);
}

function announceFreshJoin(sim: SimState, slot: PlayerSlot, name: string): void {
  broadcastAnnouncement(sim, announceJoin({
    tick: sim.tickCount,
    playerId: slot.entity.id,
    name,
    ordinal: slot.stored.slot + 1,
  }));
}

function syncModerationState(sim: SimState, slot: PlayerSlot): void {
  refreshModerationBindings(sim);
  sendModerationState(slot);
}

function tryResume(sim: SimState, request: PlayerJoinRequest): JoinResult | null {
  const existingId = sim.byToken.get(request.resumeToken!);
  const slot = existingId ? sim.players.get(existingId) : undefined;
  if (!slot || slot.connected || slot.clientId !== request.clientId) return null;
  return resumeSlot(sim, { slot, skin: request.skin });
}

function reclaimExistingClient(sim: SimState, request: PlayerJoinRequest): JoinResult | null {
  const slot = [...sim.players.values()].find((candidate) => candidate.clientId === request.clientId);
  if (!slot) return null;
  slot.entity.name = request.name;
  sim.store.get(request.clientId, request.name);
  updateHandicap(slot, request.name);
  return resumeSlot(sim, { slot, skin: request.skin });
}

function updateHandicap(slot: PlayerSlot, name: string): void {
  const handicap = handicapForPlayer(name, slot.stored.handicapGranted);
  if (handicap) slot.handicap = handicap;
  else delete slot.handicap;
}

function resumeSlot(
  sim: SimState,
  request: { slot: PlayerSlot; skin: PlayerSkin | undefined },
): JoinResult {
  const { slot, skin } = request;
  if (skin) slot.entity.skin = skin;
  restorePausedLifecycle(sim, slot);
  resetResumedSlot(slot);
  resumeSlotServices(sim, slot);
  return resumedJoinResult(sim, slot);
}

function resetResumedSlot(slot: PlayerSlot): void {
  slot.connected = true;
  resetInputTimeline(slot);
  slot.pendingActions.length = 0;
  slot.lastSeq = -1;
  slot.highestReceivedSeq = -1;
  slot.needsFullAreas = true;
}

function resumeSlotServices(sim: SimState, slot: PlayerSlot): void {
  if (slot.entity.hp > 0) ensureStarterKit(sim, slot);
  replayPartyInviteState(sim, slot);
  sendContactsUpdated(sim, slot);
  sendModerationState(slot);
  sim.store.recordFloor(slot.stored, sim.world.floor);
}

function resumedJoinResult(sim: SimState, slot: PlayerSlot): JoinResult {
  return {
    playerId: slot.entity.id,
    resumeToken: slot.resumeToken,
    spawn: { x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z },
    resumed: true,
    floor: sim.world.floor,
  };
}
