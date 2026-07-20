import {
  HOTBAR_SLOTS,
  PLAYER_MAX_HP,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { sendContactsUpdated } from "./contacts.js";
import { invAdd } from "./inventory.js";
import { findSpawn, newToken } from "./spawn.js";
import type { JoinResult, PlayerSlot, SimState } from "./state.js";

/** Player join and reconnect-resume: the entity/slot a fresh or returning client gets. */

/** ASSUMPTION #1/#2 (docs/ASSUMPTIONS.md): the existing Rusty Sword
 * auto-equips (invAdd's first-weapon rule), plus a full stack of torches. */
const STARTER_TORCH_QTY = 3;

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

  // Checked BEFORE store.get (which creates the record) — this is the
  // only point that can tell "first-ever join" from "reconnected after
  // the in-memory slot/resume token was lost" (e.g. a server restart).
  const isNewCharacter = !sim.store.has(clientId);

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
  if (isNewCharacter) grantStarterKit(sim, slot);
  // ASSUMPTION #50 (docs/ASSUMPTIONS.md): sync the contact list on every
  // join/resume so a reconnecting client doesn't wait for the next
  // fistbump seal to see it. A same-tick collision with a fistbump-seal
  // push (only possible on resume, and only if an incoming offer somehow
  // survived the disconnect) just delivers the identical list twice —
  // harmless, since the client treats contactsUpdated as a full replace.
  sendContactsUpdated(sim, slot);
  return { playerId: entity.id, resumeToken: token, spawn, resumed: false };
}

/** Granted exactly once per persistent clientId, straight into inventory
 * (never the stash) — never re-run on death/respawn or reconnect. */
function grantStarterKit(sim: SimState, slot: PlayerSlot): void {
  invAdd(sim, slot, "sword", 1);
  invAdd(sim, slot, "torch", STARTER_TORCH_QTY);
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
    chatTimestamps: [],
    lastFistbumpOfferAtTick: Number.NEGATIVE_INFINITY,
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
  sendContactsUpdated(sim, slot);
  return {
    playerId: slot.entity.id,
    resumeToken: slot.resumeToken,
    spawn: { x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z },
    resumed: true,
  };
}
