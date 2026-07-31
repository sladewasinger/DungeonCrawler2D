import { type WebSocket, type WebSocketServer } from "ws";
import { handleConnection } from "../connection/connectionHandler.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import { logServerError } from "../operations/structuredServerLog.js";
import { startHeartbeat } from "../telemetry/heartbeat.js";

export function connectWebSockets(
  wss: WebSocketServer,
  context: Parameters<typeof handleConnection>[1],
): () => void {
  const stopHeartbeat = startHeartbeat(wss);
  wss.on("connection", (ws: WebSocket, request) => handleConnection(ws, context, request));
  wss.on("error", (error) => recordWebSocketServerError(context.operationalEvents, error));
  return stopHeartbeat;
}

function recordWebSocketServerError(
  events: OperationalEventSink | undefined,
  error: Error,
): void {
  logServerError("websocket_server", error);
  events?.record({ at: Date.now(), category: "server", action: "websocket_server_error" });
}
