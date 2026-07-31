import { World, createBody, type ServerWelcome } from "@dc2d/engine";
import type { Connection } from "./connection.js";
import { saveResumeToken } from "../auth/identity.js";
import { startCorpNetWatchdog } from "../corpnet/index.js";

/** Applies the authoritative session identity and fresh world on each welcome. */
export function applyWelcome(conn: Connection, message: ServerWelcome): void {
  conn.welcome = message;
  conn.status = "connected";
  conn.reconnectAttempts = 0;
  conn.sessionExpired = false;
  conn.sessionEndMessage = null;
  saveResumeToken(message.resumeToken, message.level);
  conn.world = new World(message.worldSeed, message.floor, {
    level: message.level,
    features: message.worldFeatures,
  });
  conn.body = createBody(message.spawn.x, message.spawn.y, message.spawn.z);
  resetWelcomeState(conn);
  conn.corpNet.reset(performance.now());
  startCorpNetWatchdog(conn);
  conn.onConnected?.();
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
