import {
  HOTBAR_SLOTS,
  PLAYER_MAX_HP,
  createBody,
  makeEntity,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { announceJoin, broadcastAnnouncement } from "./announcer/index.js";
import { sendContactsUpdated } from "./contacts.js";
import { ensureStarterKit } from "./inventory.js";
import { respawnSlot } from "./players.js";
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
  // ASSUMPTION #2 (docs/ASSUMPTIONS.md) is superseded by #87: the kit is
  // no longer strictly exactly-once-per-clientId. ensureStarterKit is a
  // no-op for anyone who already has a weapon/sword/torch, so a
  // brand-new, genuinely empty slot gets granted here exactly as
  // before; a returning clientId whose in-memory slot/resume token was
  // lost (e.g. died with the only resume token they had) now gets it
  // too, instead of rejoining permanently Unarmed.
  ensureStarterKit(sim, slot);
  // ASSUMPTION #50 (docs/ASSUMPTIONS.md): sync the contact list on every
  // join/resume so a reconnecting client doesn't wait for the next
  // fistbump seal to see it. A same-tick collision with a fistbump-seal
  // push (only possible on resume, and only if an incoming offer somehow
  // survived the disconnect) just delivers the identical list twice —
  // harmless, since the client treats contactsUpdated as a full replace.
  sendContactsUpdated(sim, slot);
  // The announcer's voice (Epic 7.13, book-fan lane): ordinal is the
  // player's persistent PlayerStore slot number, not join order, so a
  // returning-but-forgotten client still gets a stable "Crawler #N".
  broadcastAnnouncement(sim, announceJoin(sim.tickCount, entity.id, name, slot.stored.slot + 1));
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
  // Join-death fix (Epic 7.13): a client that disconnected mid-death-
  // delay (respawnAtTick pending, hp still 0) must never resume into
  // that dead body — the first snapshot would carry hp<=0 and read as
  // a fresh death on reconnect. Respawn it immediately instead of
  // waiting out whatever was left of the delay; ensureStarterKit rides
  // along inside respawnSlot.
  if (slot.entity.hp <= 0) respawnSlot(sim, slot);
  else ensureStarterKit(sim, slot);
  sendContactsUpdated(sim, slot);
  return {
    playerId: slot.entity.id,
    resumeToken: slot.resumeToken,
    spawn: { x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z },
    resumed: true,
  };
}
