import type { ServerMessage } from "@dc2d/engine";
import { sendAdminServerMessage } from "../adminMessageSender.js";
import type { AdminSession } from "../access/authorization.js";
import type {
  AdminSessionInvalidationReason,
} from "../access/sessionRegistry.js";
import type { AdminDispatchContext } from "../dispatch.js";
import { newSpectatorSession } from "../spectator/spectatorSession.js";

type AdminAuthResult = Extract<ServerMessage, { type: "adminAuthResult" }>;

export function bindAdminSession(
  context: Pick<
    AdminDispatchContext,
    "admin" | "adminSessions" | "adminSubscriptions" | "conn" | "diagnostics" | "ws"
  >,
  session: AdminSession,
): boolean {
  return context.adminSessions.bind({
    session,
    peerAddress: context.conn.peerAddress,
    binding: context.ws,
    onInvalidated: (reason) => invalidateBoundAdminSession(context, reason),
  });
}

export function clearBoundAdminSession(
  context: Pick<
    AdminDispatchContext,
    "admin" | "adminSubscriptions" | "conn" | "ws"
  >,
): void {
  context.adminSubscriptions?.remove(context.ws);
  context.conn.adminSession = null;
  context.conn.spectator = context.admin?.createSpectator() ?? newSpectatorSession();
}

export function activeBoundAdminSession(
  context: Pick<AdminDispatchContext, "adminSessions" | "conn">,
): AdminSession | null {
  const session = context.conn.adminSession;
  if (!session) return null;
  return context.adminSessions.isActive({ session, peerAddress: context.conn.peerAddress })
    ? session
    : null;
}

export function touchBoundAdminSession(
  context: Pick<AdminDispatchContext, "adminSessions" | "conn">,
): AdminSession | null {
  const session = context.conn.adminSession;
  if (!session) return null;
  return context.adminSessions.touch({ session, peerAddress: context.conn.peerAddress })
    ? session
    : null;
}

export function revokeBoundAdminSession(
  context: Pick<AdminDispatchContext, "adminSessions" | "conn" | "ws">,
): void {
  const session = context.conn.adminSession;
  if (!session) return;
  context.adminSessions.unbind(context.ws);
  context.adminSessions.revoke(session);
}

function invalidateBoundAdminSession(
  context: Pick<
    AdminDispatchContext,
    "admin" | "adminSubscriptions" | "conn" | "diagnostics" | "ws"
  >,
  reason: AdminSessionInvalidationReason,
): void {
  clearBoundAdminSession(context);
  sendAdminServerMessage({
    ...context,
    message: invalidationResult(reason),
  });
}

function invalidationResult(reason: AdminSessionInvalidationReason): AdminAuthResult {
  return {
    type: "adminAuthResult",
    ok: false,
    reason: reason === "expired" ? "expired" : "logged_out",
  };
}
