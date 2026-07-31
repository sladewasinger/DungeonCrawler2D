import type { ServerMessage } from "@dc2d/engine";
import type { AdminDispatchContext } from "./dispatch.js";

type AdminAuthResult = Extract<ServerMessage, { type: "adminAuthResult" }>;

export interface AdminSessionResumeInput {
  readonly sessionKey: string;
  readonly context: Pick<
    AdminDispatchContext,
    "admin" | "adminAccess" | "adminToken" | "adminSessions" | "adminSubscriptions" | "conn" | "operationalEvents" | "ws"
  >;
  readonly sendResult: (message: AdminAuthResult) => void;
  readonly sendState: () => void;
}

export function resumeAdminSession(input: AdminSessionResumeInput): void {
  const { admin, adminToken, conn, ws } = input.context;
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
  if (!session) {
    recordResumeEvent(input, "expired");
    input.sendResult({ type: "adminAuthResult", ok: false, reason: "expired" });
    return;
  }
  conn.adminSession = session;
  input.context.adminSubscriptions?.add(ws, conn);
  recordResumeEvent(input, "accepted");
  input.sendResult({
    type: "adminAuthResult",
    ok: true,
    capabilities: [...session.capabilities],
    sessionKey: input.sessionKey,
  });
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
