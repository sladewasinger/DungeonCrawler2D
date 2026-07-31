import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { createAdminSession } from "../access/authorization.js";
import { AdminSessionRegistry } from "../access/sessionRegistry.js";
import { logoutAdminSession } from "./adminLogout.js";
import type { AdminDispatchContext } from "../dispatch.js";
import { newSpectatorSession } from "../spectator/spectatorSession.js";
import type { ConnState } from "../../types.js";

describe("admin logout", () => {
  it("revokes the current continuation, unsubscribes the socket, and clears authority", () => {
    const peerAddress = "127.0.0.1";
    const registry = new AdminSessionRegistry();
    const session = createAdminSession();
    const sessionKey = registry.issue({ session, peerAddress });
    const remove = vi.fn();
    const recordPortalLogout = vi.fn();
    const conn = connection(session, peerAddress);
    const results: unknown[] = [];

    logoutAdminSession({
      context: {
        admin: {
          createSpectator: newSpectatorSession,
          recordPortalLogout,
        } as unknown as NonNullable<AdminDispatchContext["admin"]>,
        adminSessions: registry,
        adminSubscriptions: { remove } as unknown as NonNullable<AdminDispatchContext["adminSubscriptions"]>,
        conn,
        ws: {} as WebSocket,
      },
      sendResult: (result) => results.push(result),
    });

    expect(registry.resume({ sessionKey, peerAddress })).toBeNull();
    expect(conn.adminSession).toBeNull();
    expect(remove).toHaveBeenCalledOnce();
    expect(recordPortalLogout).toHaveBeenCalledWith(session);
    expect(results).toEqual([{ type: "adminAuthResult", ok: false, reason: "logged_out" }]);
  });
});

function connection(session: ReturnType<typeof createAdminSession>, peerAddress: string): ConnState {
  return {
    playerId: null,
    lastMeaningfulActivityAt: null,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: null,
    adminSession: session,
    peerAddress,
    spectator: newSpectatorSession(),
  };
}
