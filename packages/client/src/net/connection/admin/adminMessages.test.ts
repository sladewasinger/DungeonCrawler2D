import { describe, expect, it } from "vitest";
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

    handleAdminMessage(connection, {
      type: "adminAuthResult",
      ok: false,
      reason: "expired",
    });

    expect(connection.adminAuthenticated).toBe(false);
    expect(connection.adminSessionKey).toBeNull();
  });
});
