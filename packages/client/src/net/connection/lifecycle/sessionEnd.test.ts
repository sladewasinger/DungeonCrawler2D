import { describe, expect, it } from "vitest";
import { Connection } from "../connection.js";
import { consumeSessionEndMessage } from "./sessionEnd.js";

function expiredConnection(message: string | null): Connection {
  const connection = new Connection("wss://example.test", "Tester", "client-1");
  connection.sessionExpired = true;
  connection.sessionEndMessage = message;
  return connection;
}

describe("consumeSessionEndMessage", () => {
  it("returns the server's terminal message once", () => {
    const connection = expiredConnection("Disconnected after 3 minutes of inactivity.");

    expect(consumeSessionEndMessage(connection)).toBe(
      "Disconnected after 3 minutes of inactivity.",
    );
    expect(consumeSessionEndMessage(connection)).toBeNull();
  });

  it("preserves the reconnect guidance for an exhausted reconnect lease", () => {
    expect(consumeSessionEndMessage(expiredConnection(null))).toBe(
      "Session expired — reconnect below",
    );
  });
});
