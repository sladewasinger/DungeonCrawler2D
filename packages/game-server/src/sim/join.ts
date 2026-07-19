import {
  HOTBAR_SLOTS,
  PLAYER_MAX_HP,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { findSpawn, newToken } from "./spawn.js";
import type { JoinResult, PlayerSlot, SimState } from "./state.js";

/** Player join and reconnect-resume: the entity/slot a fresh or returning client gets. */

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
