import type { ServerMessage } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { AdminAccessLimiter } from "./access/rateLimit.js";
import { createAdminSession } from "./access/authorization.js";
import { AdminSessionRegistry } from "./access/sessionRegistry.js";
import { resumeAdminSession } from "./adminSessionResume.js";
import { newSpectatorSession } from "./spectator/spectatorSession.js";
import type { AdminDispatchContext } from "./dispatch.js";
import type { ConnState } from "../types.js";

describe("admin session resume", () => {
  it("rejects a rate-limited peer before resolving its session key", () => {
    const peerAddress = "203.0.113.21";
    const limiter = new AdminAccessLimiter();
    const registry = new AdminSessionRegistry();
    const sessionKey = registry.issue({ session: createAdminSession(), peerAddress });
    const context = resumeContext(peerAddress, limiter, registry);
    const results: AdminAuthResult[] = [];
    let stateSent = false;

    for (let index = 0; index < 8; index++) limiter.acceptSessionResume(peerAddress);
    resumeAdminSession({
      sessionKey,
      context,
      sendResult: (result) => results.push(result),
      sendState: () => { stateSent = true; },
    });

    expect(context.conn.adminSession).toBeNull();
    expect(stateSent).toBe(false);
    expect(results).toEqual([{
      type: "adminAuthResult",
      ok: false,
      reason: "rate_limited",
    }]);
  });
});

function resumeContext(
  peerAddress: string,
  adminAccess: AdminAccessLimiter,
  adminSessions: AdminSessionRegistry,
): Pick<AdminDispatchContext, "admin" | "adminAccess" | "adminToken" | "adminSessions" | "conn" | "ws"> {
  return {
    admin: {} as NonNullable<AdminDispatchContext["admin"]>,
    adminAccess,
    adminToken: "configured-token",
    adminSessions,
    conn: connection(peerAddress),
    ws: {} as WebSocket,
  };
}

type AdminAuthResult = Extract<ServerMessage, { type: "adminAuthResult" }>;

function connection(peerAddress: string): ConnState {
  return {
    playerId: null,
    lastMeaningfulActivityAt: null,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: null,
    adminSession: null,
    peerAddress,
    spectator: newSpectatorSession(),
  };
}
