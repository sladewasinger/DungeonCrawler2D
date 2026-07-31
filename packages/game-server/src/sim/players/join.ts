import {
  LEVEL,
  type ClientHello,
  type PlayerSkin,
} from "@dc2d/engine";
import { sendContactsUpdated } from "../combat/contacts.js";
import { ensureStarterKit } from "../inventory/inventory.js";
import { sendModerationState } from "../moderation.js";
import { replayPartyInviteState } from "../social/partyInviteEvents.js";
import { resetInputTimeline } from "./playerInputTimeline.js";
import { newToken } from "../spawn/spawn.js";
import { createPlayerSlot } from "./joinSlot.js";
import { restorePausedLifecycle } from "./joinResume.js";
import { handicapForPlayer } from "../progression/handicap.js";
import type { JoinResult, PlayerSlot, SimState } from "../state/state.js";
import { completeFreshJoin, createPlayerEntity, initialSpawn } from "./joinFresh.js";

export interface PlayerJoinRequest {
  name: string;
  clientId: string;
  resumeToken?: string | undefined;
  skin?: PlayerSkin | undefined;
  clientMetadata?: ClientHello["clientMetadata"];
}

/** Player join and reconnect-resume: the entity/slot a fresh or returning client gets. */
export function addPlayer(sim: SimState, request: PlayerJoinRequest): JoinResult {
  const stored = sim.store.get(request.clientId, request.name, request.clientMetadata);
  const result = resumePlayer(sim, request) ?? createPlayer(sim, request, stored);
  grantSandboxAdmin(sim, result.playerId);
  return result;
}

function grantSandboxAdmin(sim: SimState, playerId: string): void {
  if (!sim.opts.debugCommands) return;
  if (sim.world.level !== LEVEL.Sandbox && sim.world.level !== LEVEL.CombatSandbox) return;
  const slot = sim.players.get(playerId);
  if (slot) slot.admin = true;
}

function resumePlayer(sim: SimState, request: PlayerJoinRequest): JoinResult | null {
  if (request.resumeToken) {
    const resumed = tryResume(sim, request);
    if (resumed) return resumed;
  }
  return reclaimExistingClient(sim, request);
}

function createPlayer(
  sim: SimState,
  request: PlayerJoinRequest,
  stored: PlayerSlot["stored"],
): JoinResult {
  const spawn = initialSpawn(sim);
  const entity = createPlayerEntity(request.name, spawn, request.skin);
  const token = newToken(sim);
  const slot = createPlayerSlot({
    entity,
    clientId: request.clientId,
    stored,
    resumeToken: token,
    tick: sim.tickCount,
  });
  sim.players.set(entity.id, slot);
  sim.byToken.set(token, entity.id);
  completeFreshJoin(sim, slot, request.name);
  return { playerId: entity.id, resumeToken: token, spawn, resumed: false, floor: sim.world.floor };
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
  slot.stored = sim.store.get(request.clientId, request.name, request.clientMetadata);
  // A client-id match is not a credential. Only a valid resume token may retain
  // the runtime admin role attached to this live slot.
  slot.admin = false;
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
