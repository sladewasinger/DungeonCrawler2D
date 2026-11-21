import { MOVE_SPEED, PLAYER_MAX_STAMINA } from "@dc2d/engine";
import type { Connection } from "../connection.js";

export function resetDisconnectedConnection(conn: Connection): void {
  resetAuthoritativeState(conn);
  resetPresentationState(conn);
  resetNetworkState(conn);
}

function resetAuthoritativeState(conn: Connection): void {
  conn.worldLoadAttempt++;
  conn.worldLoadCancel?.();
  conn.worldLoadCancel = null;
  conn.world = null;
  conn.worldReady = false;
  conn.worldLoading = false;
  conn.worldLoadError = null;
  conn.pendingFloorTransition = null;
  conn.pendingWorldSnapshot = null;
  conn.welcome = null;
  conn.body = null;
  conn.spectatorTargetPose = null;
  conn.hp = 0;
  conn.stamina = PLAYER_MAX_STAMINA;
  conn.blocking = false;
  conn.staminaRecoveryDelaySeconds = 0;
  conn.staminaExhausted = false;
  conn.healthRegenerationDelaySeconds = 0;
  conn.movementSpeed = MOVE_SPEED;
  conn.noclip = false;
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
  conn.spectatorDeathPresentations.reset();
  conn.areaTiles.clear();
  conn.areaTileLayers.clear();
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
  conn.corpNet.reset();
  conn.snapshotCoalescer.reset();
}
