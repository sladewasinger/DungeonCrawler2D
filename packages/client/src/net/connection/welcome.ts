import {
  World,
  createBody,
  type ServerWelcome,
  type SpectatorWelcome,
} from "@dc2d/engine";
import type { Connection } from "./connection.js";
import { saveResumeToken } from "../auth/identity.js";
import { startCorpNetWatchdog } from "../corpnet/index.js";

/** Applies the authoritative session identity and fresh world on each welcome. */
export function applyWelcome(conn: Connection, message: ServerWelcome): void {
  applyWorldWelcome(conn, message, true);
}

export function applySpectatorWelcome(
  conn: Connection,
  message: SpectatorWelcome,
): void {
  conn.setName(message.target.name);
  conn.setSkin(message.target.skin);
  conn.spectatorMode = message.mode;
  conn.spectatorTargetId = message.target.playerId;
  applyWorldWelcome(conn, {
    type: "welcome",
    protocol: message.protocol,
    playerId: message.target.playerId,
    resumeToken: "",
    seedInputText: message.seedInputText,
    worldSeed: message.worldSeed,
    floor: message.target.floor,
    level: message.target.level,
    worldFeatures: message.worldFeatures,
    tickRate: message.tickRate,
    spawn: message.spawn,
  }, false);
  conn.spectatorTargetPose = { ...message.spawn };
}

function applyWorldWelcome(
  conn: Connection,
  message: ServerWelcome,
  persistResumeToken: boolean,
): void {
  const notifyConnected = conn.status !== "connected";
  conn.welcome = message;
  conn.status = "connected";
  conn.reconnectAttempts = 0;
  conn.sessionExpired = false;
  conn.sessionEndMessage = null;
  if (persistResumeToken) saveResumeToken(message.resumeToken, message.level);
  conn.world = new World(message.worldSeed, message.floor, {
    level: message.level,
    features: message.worldFeatures,
  });
  conn.body = createBody(message.spawn.x, message.spawn.y, message.spawn.z);
  resetWelcomeState(conn);
  conn.corpNet.reset(performance.now());
  startCorpNetWatchdog(conn);
  if (notifyConnected) conn.onConnected?.();
  startPingTimer(conn);
}

function resetWelcomeState(conn: Connection): void {
  conn.prediction.reset();
  conn.movementCadence.reset();
  conn.predictionCorrection.reset(true);
  conn.serverTimeline.reset();
  conn.snapshotRevisions.reset();
  conn.entities.clear();
  conn.areaTiles.clear();
  conn.areaTileLayers.clear();
  conn.defeatedMiniBossArenaChunks.clear();
  conn.defeatedMiniBossArenaWindowCenter = null;
  conn.miniBossArenaLandmarkRevision++;
  conn.teleported = true;
}

function startPingTimer(conn: Connection): void {
  if (conn.pingTimer) return;
  conn.pingTimer = setInterval(() => {
    if (conn.ws?.readyState === WebSocket.OPEN) {
      conn.send({ type: "ping", t: performance.now() });
    }
  }, 2_000);
}
