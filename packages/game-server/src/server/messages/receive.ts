import { decodeClientMessage, type ClientMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { ConnState } from "../types.js";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";

export interface ReceiveContext {
  readonly ws: WebSocket;
  readonly conn: ConnState;
  readonly diagnostics: ServerNetworkDiagnostics;
}

export function receiveMessage(
  raw: string,
  context: ReceiveContext,
  dispatch: (message: ClientMessage) => void,
): void {
  const startedAt = performance.now();
  const message = decodeClientMessage(raw);
  const decodedAt = performance.now();
  recordInbound({ raw: inboundDiagnosticPayload(raw, message?.type), codecMilliseconds: decodedAt - startedAt, nowMs: decodedAt, context });
  if (message) dispatch(message);
  else closeUnauthenticatedSocket(context.ws, context.conn);
}

interface InboundRecord {
  readonly raw: string;
  readonly codecMilliseconds: number;
  readonly nowMs: number;
  readonly context: ReceiveContext;
}

export function inboundDiagnosticPayload(raw: string, type: ClientMessage["type"] | undefined): string {
  return isAdminCredentialMessage(type) || resemblesAdminCredentialMessage(raw)
    ? '{"type":"adminCredential","redacted":true}'
    : raw;
}

function isAdminCredentialMessage(type: ClientMessage["type"] | undefined): boolean {
  return type === "adminAuth" || type === "adminResume";
}

function resemblesAdminCredentialMessage(raw: string): boolean {
  return /"type"\s*:\s*"admin(?:Auth|Resume)"/.test(raw);
}

function recordInbound({ raw, codecMilliseconds, nowMs, context }: InboundRecord): void {
  context.diagnostics.record({
    playerId: context.conn.playerId,
    direction: "inbound",
    payload: raw,
    codecMilliseconds,
    queueBytes: context.ws.bufferedAmount,
    nowMs,
  });
}

function closeUnauthenticatedSocket(ws: WebSocket, conn: ConnState): void {
  if (conn.playerId !== null) return;
  conn.terminationReason = "malformed_message";
  ws.close(1002, "bad message");
}
