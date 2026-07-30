import {
  PROTOCOL_VERSION,
  RECONNECT_GRACE_MS,
  type ServerMessage,
} from "@dc2d/engine";
import { applySnapshot } from "../sync/apply.js";
import type { Connection } from "./connection.js";
import { clearResumeToken, loadResumeToken } from "../auth/identity.js";
import { decodeMeasuredServerMessage } from "../transport/measuredDecode.js";
import {
  queueCorpNetSnapshot,
  stopCorpNetWatchdog,
} from "../corpnet/index.js";
import { applySnapshotDelta } from "../snapshots/snapshotDelta.js";
import { applyWelcome } from "./welcome.js";

/**
 * WebSocket wire mechanics for Connection: open/close, the hello
 * handshake, reconnect-with-backoff, and dispatching decoded server
 * messages. Connection owns the state these functions mutate.
 */

const RETRY_INTERVAL_MS = 1000;
/** One attempt per RETRY_INTERVAL_MS, comfortably past the server's own
 * RECONNECT_GRACE_MS slot-reap window plus slack for clock/latency drift —
 * past this, resuming genuinely can't succeed, so retrying further is a
 * dead spinner, not patience (Epic 7.12). */
const MAX_RECONNECT_ATTEMPTS = Math.ceil(RECONNECT_GRACE_MS / RETRY_INTERVAL_MS) + 5;

export function openSocket(conn: Connection): void {
  conn.shouldReconnect = true;
  conn.status = "connecting";
  conn.sessionExpired = false;
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  conn.reconnectTimer = null;
  const previous = conn.ws;
  conn.ws = null;
  if (previous && previous.readyState < WebSocket.CLOSING) previous.close();
  const ws = new WebSocket(conn.url);
  conn.ws = ws;
  attachSocketHandlers(conn, ws);
}

function attachSocketHandlers(conn: Connection, ws: WebSocket): void {
  ws.onopen = () => {
    if (conn.ws !== ws) return;
    const resumeToken = loadResumeToken(conn.level);
    conn.send({
      type: "hello",
      protocol: PROTOCOL_VERSION,
      name: conn.name,
      skin: conn.skin,
      clientId: conn.clientId,
      level: conn.level,
      snapshotMode: "delta-v1",
      networkProfile: conn.corpNet.enabled ? "corpnet" : null,
      ...(resumeToken ? { resumeToken } : {}),
    });
  };

  ws.onmessage = (event) => {
    const raw = String(event.data);
    const msg = decodeMeasuredServerMessage(raw, ws.bufferedAmount, conn.networkMetrics);
    if (conn.ws === ws && msg) handleMessage(conn, msg);
  };

  ws.onclose = () => handleClose(conn, ws);
}

/** Socket dropped: clears wire bookkeeping, then either schedules the next backoff
 * retry or — past MAX_RECONNECT_ATTEMPTS — gives up and flags the session expired. */
function handleClose(conn: Connection, ws: WebSocket): void {
  if (conn.ws !== ws) return;
  conn.ws = null;
  conn.status = "closed";
  if (conn.pingTimer) clearInterval(conn.pingTimer);
  conn.pingTimer = null;
  stopCorpNetWatchdog(conn);
  if (!conn.shouldReconnect) return;
  conn.reconnectAttempts++;
  if (conn.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    conn.shouldReconnect = false;
    conn.sessionExpired = true;
    clearResumeToken(conn.level);
    return;
  }
  conn.reconnectTimer = setTimeout(() => openSocket(conn), RETRY_INTERVAL_MS);
}

export function closeSocket(conn: Connection): void {
  conn.shouldReconnect = false;
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  conn.reconnectTimer = null;
  if (conn.pingTimer) clearInterval(conn.pingTimer);
  conn.pingTimer = null;
  stopCorpNetWatchdog(conn);
  const ws = conn.ws;
  conn.ws = null;
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  conn.status = "closed";
}

export function requireConnectionUpdate(conn: Connection, message: string): void {
  conn.updateRequired = true;
  conn.updateRequiredMessage = message;
  closeSocket(conn);
  conn.onUpdateRequired?.(message);
}

function handleMessage(conn: Connection, msg: ServerMessage): void {
  switch (msg.type) {
    case "welcome":
      applyWelcome(conn, msg);
      return;
    case "snapshot":
    case "snapshotDelta":
      if (conn.corpNet.enabled) {
        queueCorpNetSnapshot(conn, msg, performance.now());
      } else {
        applyImmediateSnapshot(conn, msg);
      }
      return;
    case "pong": {
      const roundTrip = performance.now() - msg.t;
      conn.rttMs = roundTrip;
      conn.networkMetrics.recordRoundTrip(roundTrip);
      return;
    }
    case "error":
      console.error(`[server] ${msg.code}: ${msg.message}`);
      if (msg.code === "protocol_mismatch") requireConnectionUpdate(conn, msg.message);
      return;
  }
}

function applyImmediateSnapshot(
  conn: Connection,
  msg: Extract<ServerMessage, { type: "snapshot" | "snapshotDelta" }>,
): void {
  if (msg.type === "snapshot") {
    conn.snapshotRevisions.reset();
    applySnapshot(conn, msg);
    return;
  }
  applySnapshotDelta(conn, msg);
}
