import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { ClientMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { SocketMap } from "../types.js";
import { adminTokenMatches } from "./access/auth.js";
import { createAdminSession } from "./access/authorization.js";
import type { AdminSessionRegistry } from "./access/sessionRegistry.js";
import type { AdminController } from "./controller.js";
import { type ConnState } from "../types.js";
import type { AdminAccessLimiter } from "./access/rateLimit.js";
import { isAdminChatCommand, parseAdminChatCommand } from "./commands/chatCommands.js";
import { sendAdminServerMessage, type AdminServerMessage } from "./adminMessageSender.js";
import type { AdminInboundMessage } from "./adminMessageTypes.js";
import { resumeAdminSession } from "./adminSessionResume.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import { recordAdminSecurityEvent } from "./audit/adminSecurityEvent.js";
import {
  executeAdminInboundCommand,
  executeAuthorizedAdminCommand,
} from "./commands/adminCommandExecution.js";

export interface AdminDispatchContext {
  readonly ws: WebSocket;
  readonly conn: ConnState;
  readonly sockets: SocketMap;
  readonly diagnostics: ServerNetworkDiagnostics;
  readonly admin?: AdminController;
  readonly adminToken?: string | null;
  readonly adminAccess: AdminAccessLimiter;
  readonly adminSessions: AdminSessionRegistry;
  readonly adminSubscriptions?: import("./observer/adminStateSubscriptions.js").AdminStateSubscriptions;
  readonly operationalEvents?: OperationalEventSink;
}

export function dispatchAdminMessage(
  message: AdminInboundMessage,
  context: AdminDispatchContext,
): void {
  if (message.type === "adminAuth") authenticate(message.token, context);
  else if (message.type === "adminResume") resumeAdminSession({
    sessionKey: message.sessionKey,
    context,
    sendResult: (result) => sendResult(context, result),
    sendState: () => sendState(context),
  });
  else executeAdminInboundCommand(message, context);
}

export function dispatchAdminChatMessage(
  message: Extract<ClientMessage, { type: "chat" }>,
  context: AdminDispatchContext,
): boolean {
  if (!isAdminChatCommand(message.text)) return false;
  if (!context.admin || !adminChatAuthority(context)) {
    recordSecurityEvent(context, "command_rejected", "unauthorized");
    sendResult(context, { type: "adminCommandResult", ok: false, code: "unauthorized" });
    return true;
  }
  const command = parseAdminChatCommand(message.text);
  if (!command) {
    sendResult(context, { type: "adminCommandResult", ok: false, code: "invalid_admin_command" });
    return true;
  }
  if (!context.adminAccess.acceptAuthenticatedCommand(context.conn.peerAddress)) {
    recordSecurityEvent(context, "command_rejected", "rate_limited");
    sendResult(context, { type: "adminCommandResult", ok: false, code: "rate_limited" });
    return true;
  }
  executeAuthorizedAdminCommand(command, undefined, context);
  return true;
}

function authenticate(token: string, context: AdminDispatchContext): void {
  const { ws, conn, admin, adminToken } = context;
  if (!adminToken || !admin) {
    recordSecurityEvent(context, "authentication_rejected", "disabled");
    return sendResult(context, { type: "adminAuthResult", ok: false, reason: "disabled" });
  }
  if (!context.adminAccess.canAttemptAuthentication(conn.peerAddress)) {
    conn.terminationReason = "admin_rate_limited";
    recordSecurityEvent(context, "authentication_rejected", "rate_limited");
    sendResult(context, { type: "adminAuthResult", ok: false, reason: "rate_limited" });
    ws.close(1008, "admin rate limited");
    return;
  }
  if (!adminTokenMatches(token, adminToken)) return rejectToken(context);
  conn.adminSession = createAdminSession();
  const sessionKey = context.adminSessions.issue({
    session: conn.adminSession,
    peerAddress: conn.peerAddress,
  });
  context.adminSubscriptions?.add(ws, conn);
  context.adminAccess.clearFailedAuthentication(conn.peerAddress);
  recordSecurityEvent(context, "authenticated", "accepted");
  sendResult(context, {
    type: "adminAuthResult",
    ok: true,
    capabilities: [...conn.adminSession.capabilities],
    sessionKey,
  });
  sendState(context);
}

function rejectToken(context: AdminDispatchContext): void {
  const { ws, conn } = context;
  const rateLimited = context.adminAccess.recordFailedAuthentication(conn.peerAddress);
  const reason = rateLimited ? "rate_limited" : "invalid";
  if (rateLimited) conn.terminationReason = "admin_rate_limited";
  recordSecurityEvent(context, "authentication_rejected", reason);
  sendResult(context, { type: "adminAuthResult", ok: false, reason });
  if (rateLimited) ws.close(1008, "admin rate limited");
}

function adminChatAuthority(context: AdminDispatchContext): "token" | "active" | null {
  if (context.conn.adminSession) return "token";
  return activeAdminOwnsSocket(context) ? "active" : null;
}

function activeAdminOwnsSocket(context: AdminDispatchContext): boolean {
  const playerId = context.conn.playerId;
  if (!playerId) return false;
  const entry = context.sockets.get(playerId);
  return entry?.ws === context.ws && entry.sim.admin.isActiveAdmin(playerId);
}

function sendState(context: AdminDispatchContext, state?: ReturnType<AdminController["state"]>): void {
  const { admin, conn } = context;
  if (!admin || !conn.adminSession) return;
  sendResult(context, state ?? admin.state(conn.spectator, conn.adminSession));
}

function sendResult(context: AdminDispatchContext, message: AdminServerMessage): void {
  sendAdminServerMessage({ ...context, message });
}

function recordSecurityEvent(
  context: AdminDispatchContext,
  action: Parameters<typeof recordAdminSecurityEvent>[0]["action"],
  outcome: Parameters<typeof recordAdminSecurityEvent>[0]["outcome"],
): void {
  recordAdminSecurityEvent({
    events: context.operationalEvents,
    conn: context.conn,
    action,
    outcome,
  });
}
