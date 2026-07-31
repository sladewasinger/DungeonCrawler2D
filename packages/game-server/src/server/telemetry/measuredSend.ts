/** Sends one server message and records only payloads accepted by an open socket. */
import { encodeMessage, type ServerMessage } from "@dc2d/engine";
import { WebSocket } from "ws";
import type { ServerNetworkDiagnostics } from "./networkDiagnostics.js";

export interface ServerMessageSend {
  socket: WebSocket;
  playerId: string | null;
  message: ServerMessage;
  diagnostics: ServerNetworkDiagnostics | undefined;
}

export function sendServerMessage({ socket, playerId, message, diagnostics }: ServerMessageSend): boolean {
  if (socket.readyState !== WebSocket.OPEN) return false;
  const startedAt = performance.now();
  const payload = encodeMessage(message);
  const encodedAt = performance.now();
  try {
    socket.send(payload);
  } catch {
    return false;
  }
  diagnostics?.record({
    playerId,
    direction: "outbound",
    payload: outboundDiagnosticPayload(message, payload),
    codecMilliseconds: encodedAt - startedAt,
    queueBytes: socket.bufferedAmount,
    nowMs: encodedAt,
  });
  return true;
}

export function outboundDiagnosticPayload(message: ServerMessage, payload: string): string {
  return message.type === "adminAuthResult"
    ? '{"type":"adminCredential","redacted":true}'
    : payload;
}
