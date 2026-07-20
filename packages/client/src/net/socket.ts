import {
  PROTOCOL_VERSION,
  RECONNECT_GRACE_MS,
  World,
  createBody,
  decodeServerMessage,
  type ServerWelcome,
} from "@dc2d/engine";
import { applySnapshot } from "./apply.js";
import type { Connection } from "./connection.js";
import { clearResumeToken, loadResumeToken, saveResumeToken } from "./identity.js";

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

  ws.onopen = () => {
    if (conn.ws !== ws) return;
    const resumeToken = loadResumeToken(conn.level);
    conn.send({
      type: "hello",
      protocol: PROTOCOL_VERSION,
      name: conn.name,
      clientId: conn.clientId,
      level: conn.level,
      ...(resumeToken ? { resumeToken } : {}),
    });
  };

  ws.onmessage = (event) => {
    const msg = decodeServerMessage(String(event.data));
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
  const ws = conn.ws;
  conn.ws = null;
  if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  conn.status = "closed";
}

function handleMessage(conn: Connection, msg: NonNullable<ReturnType<typeof decodeServerMessage>>): void {
  switch (msg.type) {
    case "welcome":
      onWelcome(conn, msg);
      return;
    case "snapshot":
      applySnapshot(conn, msg);
      return;
    case "pong":
      conn.rttMs = performance.now() - msg.t;
      return;
    case "error":
      console.error(`[server] ${msg.code}: ${msg.message}`);
      return;
  }
}

function onWelcome(conn: Connection, msg: ServerWelcome): void {
  conn.welcome = msg;
  conn.status = "connected";
  conn.reconnectAttempts = 0;
  conn.sessionExpired = false;
  saveResumeToken(msg.resumeToken, msg.level);
  conn.world = new World(msg.worldSeed, msg.floor, msg.level);
  conn.body = createBody(msg.spawn.x, msg.spawn.y, msg.spawn.z);
  conn.prediction.reset();
  conn.entities.clear();
  conn.areaTiles.clear();
  conn.teleported = true;
  conn.onConnected?.();
  if (!conn.pingTimer) {
    conn.pingTimer = setInterval(() => {
      if (conn.ws?.readyState === WebSocket.OPEN) {
        conn.send({ type: "ping", t: performance.now() });
      }
    }, 2000);
  }
}
