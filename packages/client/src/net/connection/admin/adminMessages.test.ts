import { describe, expect, it, vi } from "vitest";
import { Connection } from "../connection.js";
import { handleAdminMessage } from "./adminMessages.js";

function adminConnection(): Connection {
  return new Connection("ws://example.test", "Admin", "admin-client");
}

describe("admin authentication messages", () => {
  it("keeps the opaque continuation key only after a successful authentication", () => {
    const connection = adminConnection();
    const sessionKey = "a".repeat(43);

    handleAdminMessage(connection, {
      type: "adminAuthResult",
      ok: true,
      capabilities: ["players:read"],
      sessionKey,
    });

    expect(connection.adminAuthenticated).toBe(true);
    expect(connection.adminSessionKey).toBe(sessionKey);
  });

  it("forgets a rejected or expired continuation key", () => {
    const connection = adminConnection();
    connection.adminSessionKey = "a".repeat(43);
    const authResult = vi.fn();
    connection.onAdminAuth = authResult;

    handleAdminMessage(connection, {
      type: "adminAuthResult",
      ok: false,
      reason: "expired",
    });

    expect(connection.adminAuthenticated).toBe(false);
    expect(connection.adminSessionKey).toBeNull();
    expect(authResult).toHaveBeenCalledWith(false, "expired");
  });

  it("clears privileged portal data only after the server confirms logout", () => {
    const connection = adminConnection();
    connection.adminAuthenticated = true;
    connection.adminSessionKey = "a".repeat(43);
    connection.adminHistory = [{ at: 1, actor: "Portal admin", action: "spawn", ok: true }];
    connection.adminPlayers = [player()];

    handleAdminMessage(connection, {
      type: "adminAuthResult",
      ok: false,
      reason: "logged_out",
    });

    expect(connection.adminSessionKey).toBeNull();
    expect(connection.adminHistory).toEqual([]);
    expect(connection.adminPlayers).toEqual([]);
  });
});

function player() {
  return {
    playerId: "player-1",
    profileId: "profile-1",
    name: "Austin",
    level: "dungeon" as const,
    floor: 1,
    x: 0,
    y: 0,
    z: 0,
    hp: 30,
    maxHp: 30,
    downed: false,
    god: false,
    handicapped: false,
    admin: false,
    statuses: [],
    connected: true,
    clientId: "client-1",
  };
}
