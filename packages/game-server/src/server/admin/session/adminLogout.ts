import type { ServerMessage } from "@dc2d/engine";
import type { AdminDispatchContext } from "../dispatch.js";
import { clearBoundAdminSession } from "./adminSessionBinding.js";

type AdminAuthResult = Extract<ServerMessage, { type: "adminAuthResult" }>;

export interface AdminLogoutInput {
  readonly context: Pick<
    AdminDispatchContext,
    "admin" | "adminSessions" | "conn" | "ws"
  > & {
    readonly adminSubscriptions?: NonNullable<AdminDispatchContext["adminSubscriptions"]>;
  };
  readonly sendResult: (result: AdminAuthResult) => void;
}

/** Revokes the server-held continuation before telling the browser it is out. */
export function logoutAdminSession(input: AdminLogoutInput): void {
  const { admin, adminSessions, conn, ws } = input.context;
  const session = conn.adminSession;
  if (session) {
    admin?.recordPortalLogout(session);
    adminSessions.unbind(ws);
    adminSessions.revoke(session);
  }
  clearBoundAdminSession(input.context);
  input.sendResult({ type: "adminAuthResult", ok: false, reason: "logged_out" });
}
