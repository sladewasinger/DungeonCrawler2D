import { PLAYER_MAX_STAMINA } from "@dc2d/engine";
import type { Connection } from "./connection.js";

export function resetDisconnectedConnection(conn: Connection): void {
  resetAuthoritativeState(conn);
  resetPresentationState(conn);
  resetNetworkState(conn);
}

function resetAuthoritativeState(conn: Connection): void {
  conn.world = null;
  conn.welcome = null;
  conn.body = null;
  conn.hp = 0;
  conn.stamina = PLAYER_MAX_STAMINA;
  conn.blocking = false;
  conn.staminaRecoveryDelaySeconds = 0;
  conn.staminaExhausted = false;
  conn.healthRegenerationDelaySeconds = 0;
  conn.downed = false;
  conn.respawnAtTick = null;
  conn.justRespawned = false;
  conn.hasReceivedSnapshot = false;
}

function resetPresentationState(conn: Connection): void {
  conn.snapshotRevisions.reset();
  conn.entities.clear();
  conn.pendingInvite = null;
  conn.outgoingPartyInvites.clear();
  conn.clearInterpolationFrame();
  conn.areaTiles.clear();
  conn.npcSpeech = null;
  conn.roomDoors = [];
  conn.stashContext = { kind: "personal", chestId: null };
}

function resetNetworkState(conn: Connection): void {
  conn.prediction.reset();
  conn.movementCadence.reset();
  conn.predictionCorrection.reset();
  conn.serverTimeline.reset();
  conn.interpolationDelay.reset();
}
