import type { ServerMessage } from "@dc2d/engine";
import type { AdminDispatchContext } from "../dispatch.js";
import type { AdminSession } from "../access/authorization.js";
import { bindAdminSession } from "./adminSessionBinding.js";

type AdminAuthResult = Extract<ServerMessage, { type: "adminAuthResult" }>;

export interface AdminSessionResumeInput {
  readonly sessionKey: string;
  readonly context: Pick<
    AdminDispatchContext,
    "admin" | "adminAccess" | "adminToken" | "adminSessions" | "adminSubscriptions" | "conn" | "diagnostics" | "operationalEvents" | "ws"
  >;
  readonly sendResult: (message: AdminAuthResult) => void;
  readonly sendState: () => void;
}

export function resumeAdminSession(input: AdminSessionResumeInput): void {
  const { admin, adminToken, conn } = input.context;
  if (!adminToken || !admin) {
    recordResumeEvent(input, "disabled");
    input.sendResult({ type: "adminAuthResult", ok: false, reason: "disabled" });
    return;
  }
  if (!input.context.adminAccess.acceptSessionResume(conn.peerAddress)) {
    recordResumeEvent(input, "rate_limited");
    input.sendResult({ type: "adminAuthResult", ok: false, reason: "rate_limited" });
    return;
  }
  const session = input.context.adminSessions.resume({
    sessionKey: input.sessionKey,
    peerAddress: conn.peerAddress,
  });
  if (!session) return rejectExpiredSession(input);
  acceptResumedSession(input, session);
}

function rejectExpiredSession(input: AdminSessionResumeInput): void {
  recordResumeEvent(input, "expired");
  input.sendResult({ type: "adminAuthResult", ok: false, reason: "expired" });
}

function acceptResumedSession(
  input: AdminSessionResumeInput,
  session: AdminSession,
): void {
  const { conn, ws } = input.context;
  conn.adminSession = session;
  if (!bindAdminSession(input.context, session)) {
    conn.adminSession = null;
    return rejectExpiredSession(input);
  }
  input.context.adminSubscriptions?.add(ws, conn);
  recordResumeEvent(input, "accepted");
  input.sendResult({ type: "adminAuthResult", ok: true, capabilities: [...session.capabilities], sessionKey: input.sessionKey });
  input.sendState();
}

function recordResumeEvent(
  input: AdminSessionResumeInput,
  outcome: "accepted" | "disabled" | "expired" | "rate_limited",
): void {
  const { conn, operationalEvents } = input.context;
  operationalEvents?.record({
    at: Date.now(),
    category: "security",
    action: "session_resume",
    ...(conn.playerId ? { actorId: conn.playerId } : (conn.peerFingerprint ? { actorId: conn.peerFingerprint } : {})),
    attributes: { outcome },
  });
}
