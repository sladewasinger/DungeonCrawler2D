/** Sends one server message and records only payloads accepted by an open socket. */
import { encodeMessage, type ServerMessage } from "@dc2d/engine";
import { WebSocket } from "ws";
import type { ServerNetworkDiagnostics } from "./networkDiagnostics.js";

export function sendServerMessage(
  socket: WebSocket,
  playerId: string | null,
  message: ServerMessage,
  diagnostics?: ServerNetworkDiagnostics,
): boolean {
  if (socket.readyState !== WebSocket.OPEN) return false;
  const startedAt = performance.now();
  const payload = encodeMessage(message);
  const encodedAt = performance.now();
  try {
    socket.send(payload);
  } catch {
    return false;
  }
  diagnostics?.record(
    playerId,
    "outbound",
    payload,
    encodedAt - startedAt,
    socket.bufferedAmount,
    encodedAt,
  );
  return true;
}
