import type { ServerMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import { sendServerMessage } from "../telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { ConnState } from "../types.js";

export type AdminServerMessage = Extract<
  ServerMessage,
  { type: "adminAuthResult" | "adminCommandResult" | "adminState" }
>;

export interface AdminMessageSenderInput {
  readonly ws: WebSocket;
  readonly conn: ConnState;
  readonly diagnostics: ServerNetworkDiagnostics;
  readonly message: AdminServerMessage;
}

export function sendAdminServerMessage(input: AdminMessageSenderInput): void {
  sendServerMessage({
    socket: input.ws,
    playerId: input.conn.playerId,
    message: input.message,
    diagnostics: input.diagnostics,
  });
}
