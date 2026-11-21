import type { ClientMessage } from "@dc2d/engine";
import { sendAdminServerMessage, type AdminServerMessage } from "../adminMessageSender.js";
import type { AdminDispatchContext } from "../dispatch.js";
import { recordAdminSecurityEvent } from "../audit/adminSecurityEvent.js";
import {
  activeBoundAdminSession,
  touchBoundAdminSession,
} from "../session/adminSessionBinding.js";

type AdminCommand = Extract<ClientMessage, { type: "adminCommand" }> ["command"];

export function executeAdminInboundCommand(
  message: Extract<ClientMessage, { type: "adminCommand" }>,
  context: AdminDispatchContext,
): void {
  if (!context.admin || !hasAdminAuthority(context)) {
    recordRejection(context, "unauthorized");
    return sendOutcome(context, { ok: false, code: "unauthorized" }, message.requestId);
  }
  if (!context.adminAccess.acceptAuthenticatedCommand(context.conn.peerAddress)) {
    recordRejection(context, "rate_limited");
    return sendOutcome(context, { ok: false, code: "rate_limited" }, message.requestId);
  }
  executeAuthorizedAdminCommand(message.command, message.requestId, context);
}

function recordRejection(context: AdminDispatchContext, outcome: "unauthorized" | "rate_limited"): void {
  recordAdminSecurityEvent({ events: context.operationalEvents, conn: context.conn, action: "command_rejected", outcome });
}

export function executeAuthorizedAdminCommand(
  command: AdminCommand,
  requestId: string | undefined,
  context: AdminDispatchContext,
): void {
  const { admin, conn } = context;
  if (!admin) return sendOutcome(context, { ok: false, code: "unauthorized" }, requestId);
  if (command.op === "applyGeneratedFloor") return executeApplyGeneratedFloor(command, requestId, context);
  const session = touchBoundAdminSession(context);
  if (session) return executeTokenCommand({ command, requestId, context, session });
  sendOutcome(context, admin.executeActive({ spectator: conn.spectator, command, operatorPlayerId: conn.playerId }), requestId);
}

function executeApplyGeneratedFloor(
  command: Extract<AdminCommand, { op: "applyGeneratedFloor" }>,
  requestId: string | undefined,
  context: AdminDispatchContext,
): void {
  const session = touchBoundAdminSession(context);
  if (!session || !context.admin) {
    sendOutcome(context, { ok: false, code: "unauthorized" }, requestId);
    return;
  }
  void context.admin.applyGeneratedFloor({
    session,
    command,
    operatorPlayerId: context.conn.playerId,
  }).then((outcome) => {
    sendOutcome(context, outcome, requestId);
    sendAdminMessage(context, context.admin!.state(context.conn.spectator, session));
  }).catch(() => sendOutcome(context, { ok: false, code: "apply_failed" }, requestId));
}

interface TokenCommandExecution {
  readonly command: AdminCommand;
  readonly requestId: string | undefined;
  readonly context: AdminDispatchContext;
  readonly session: import("../access/authorization.js").AdminSession;
}

function executeTokenCommand(input: TokenCommandExecution): void {
  const { command, requestId, context, session } = input;
  if (!context.admin) return;
  const outcome = context.admin.execute({ session, spectator: context.conn.spectator, command, operatorPlayerId: context.conn.playerId });
  sendOutcome(context, outcome, requestId);
  sendAdminMessage(context, outcome.state);
}

function hasAdminAuthority(context: AdminDispatchContext): boolean {
  if (activeBoundAdminSession(context)) return true;
  const playerId = context.conn.playerId;
  if (!playerId) return false;
  const entry = context.sockets.get(playerId);
  return entry?.ws === context.ws && entry.sim.admin.isActiveAdmin(playerId);
}

function sendOutcome(
  context: AdminDispatchContext,
  outcome: { readonly ok: boolean; readonly code?: string; readonly message?: string; readonly floor?: number; readonly generation?: import("@dc2d/engine").FloorGenerationIdentity },
  requestId: string | undefined,
): void {
  sendAdminMessage(context, {
    type: "adminCommandResult", ok: outcome.ok,
    ...(requestId ? { requestId } : {}),
    ...(outcome.code ? { code: outcome.code } : {}),
    ...(outcome.message ? { message: outcome.message } : {}),
    ...(outcome.floor !== undefined ? { floor: outcome.floor } : {}),
    ...(outcome.generation ? { generation: outcome.generation } : {}),
  });
}

function sendAdminMessage(context: AdminDispatchContext, message: AdminServerMessage): void {
  sendAdminServerMessage({ ...context, message });
}
