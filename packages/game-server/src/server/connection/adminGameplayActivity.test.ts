import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createAdminSession } from "../admin/access/authorization.js";
import { newSpectatorSession } from "../admin/spectator/spectatorSession.js";
import { recordLiveAdminActivity } from "./adminGameplayActivity.js";
import type { ServerConnectionMessageContext } from "./connectionContext.js";
import type { ConnState } from "../types.js";

describe("live admin gameplay activity", () => {
  it("does not refresh an ordinary player's idle lease with rejected admin commands", () => {
    const { conn, context } = activityContext(false, null);

    recordLiveAdminActivity({ type: "adminCommand", command: { op: "list" } }, context, 20);

    expect(conn.lastMeaningfulActivityAt).toBe(10);
  });

  it("refreshes the idle lease for an active admin or token-authenticated admin", () => {
    const active = activityContext(true, null);
    const token = activityContext(false, createAdminSession());

    recordLiveAdminActivity({ type: "adminCommand", command: { op: "list" } }, active.context, 20);
    recordLiveAdminActivity({ type: "adminCommand", command: { op: "list" } }, token.context, 30);

    expect(active.conn.lastMeaningfulActivityAt).toBe(20);
    expect(token.conn.lastMeaningfulActivityAt).toBe(30);
  });
});

function activityContext(activeAdmin: boolean, adminSession: ConnState["adminSession"]): {
  readonly conn: ConnState;
  readonly context: ServerConnectionMessageContext;
} {
  const conn = connection(adminSession);
  const ws = {} as WebSocket;
  const sim = { admin: { isActiveAdmin: () => activeAdmin } };
  const sockets = new Map([["player-1", { ws, sim }]]);
  return { conn, context: { conn, ws, sockets } as unknown as ServerConnectionMessageContext };
}

function connection(adminSession: ConnState["adminSession"]): ConnState {
  return {
    playerId: "player-1",
    lastMeaningfulActivityAt: 10,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: null,
    adminSession,
    peerAddress: "127.0.0.1",
    spectator: newSpectatorSession(),
  };
}
