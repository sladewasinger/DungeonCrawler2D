import type { WebSocket } from "ws";
import { receiveMessage } from "../messages/receive.js";
import type { ConnState, SocketMap } from "../types.js";
import type { AdminStateSubscriptions } from "../admin/observer/adminStateSubscriptions.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import { dispatchMessage } from "../dispatch.js";
import { logServerError } from "../operations/structuredServerLog.js";
import {
  createServerConnectionMessageContext,
  type ServerConnectionContext,
} from "./connectionContext.js";
import { recordConnectionClosed, recordConnectionOpened } from "./connectionLifecycle.js";
import type { SpectatorSubscriptions } from "../spectator/spectatorSubscriptions.js";
import type { AdminSessionRegistry } from "../admin/access/sessionRegistry.js";

export function handleConnection(
  ws: WebSocket,
  context: ServerConnectionContext,
  request?: Parameters<typeof createServerConnectionMessageContext>[2],
): void {
  const messageContext = createServerConnectionMessageContext(ws, context, request);
  const { conn } = messageContext;
  recordConnectionOpened(context.operationalEvents, conn);
  ws.on("message", (data) => receiveMessage(data.toString(), messageContext, (message) => dispatchMessage(message, messageContext)));
  ws.on("error", (error) => recordConnectionTransportError(context.operationalEvents, error));
  ws.on("close", (code) => disconnectSocket({
    ws,
    conn,
    code,
    sockets: context.sockets,
    diagnostics: context.diagnostics,
    operationalEvents: context.operationalEvents,
    adminSessions: context.adminSessions,
    adminSubscriptions: context.adminSubscriptions,
    spectatorSubscriptions: context.spectatorSubscriptions,
  }));
}

function recordConnectionTransportError(
  events: OperationalEventSink | undefined,
  error: Error,
): void {
  logServerError("websocket_connection", error);
  events?.record({ at: Date.now(), category: "server", action: "websocket_connection_error" });
}

interface DisconnectContext {
  readonly ws: WebSocket;
  readonly conn: ConnState;
  readonly code: number;
  readonly sockets: SocketMap;
  readonly diagnostics: ServerNetworkDiagnostics;
  readonly operationalEvents: OperationalEventSink | undefined;
  readonly adminSessions: AdminSessionRegistry;
  readonly adminSubscriptions: AdminStateSubscriptions | undefined;
  readonly spectatorSubscriptions: SpectatorSubscriptions | undefined;
}

function disconnectSocket(input: DisconnectContext): void {
  const { ws, conn, code, sockets, diagnostics, operationalEvents, adminSessions, adminSubscriptions, spectatorSubscriptions } = input;
  adminSessions.unbind(ws);
  adminSubscriptions?.remove(ws);
  spectatorSubscriptions?.remove(ws);
  recordConnectionClosed({ events: operationalEvents, conn, code });
  if (!conn.playerId) return;
  const entry = sockets.get(conn.playerId);
  if (entry?.ws !== ws) return;
  sockets.delete(conn.playerId);
  entry.sim.markDisconnected(conn.playerId);
  diagnostics.removeClient(conn.playerId);
}
