// Headless tests for Connection's derived getters — no socket/World needed since the
// constructor does no I/O and every field the getters read is a plain public property.
import { describe, expect, it, vi } from "vitest";
import { Connection } from "./connection.js";
import { requireConnectionIdleTimeout, requireConnectionUpdate } from "./socket.js";

function freshConnection(): Connection {
  return new Connection("wss://example.test", "Tester", "client-1");
}

describe("Connection.dead", () => {
  it("is false before any snapshot has ever been applied, even though hp defaults to 0 (ASSUMPTIONS #88)", () => {
    const conn = freshConnection();
    conn.status = "connected";
    expect(conn.hp).toBe(0);
    expect(conn.dead).toBe(false);
  });

  it("is false while still connecting, regardless of hp", () => {
    const conn = freshConnection();
    conn.hasReceivedSnapshot = true;
    conn.hp = 0;
    expect(conn.dead).toBe(false);
  });

  it("is true only once a real snapshot reports a scheduled corpse", () => {
    const conn = freshConnection();
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 0;
    expect(conn.dead).toBe(false);
    conn.respawnAtTick = 100;
    expect(conn.dead).toBe(true);
  });

  it("does not classify the downed revive window as fully dead", () => {
    const conn = freshConnection();
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 0;
    conn.downed = true;
    conn.respawnAtTick = 100;
    expect(conn.dead).toBe(false);
  });

  it("is false once a real snapshot reported positive hp", () => {
    const conn = freshConnection();
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 12;
    expect(conn.dead).toBe(false);
  });
});

describe("Connection.disconnect", () => {
  it("resets hasReceivedSnapshot so a fresh reconnect can't inherit a phantom death", () => {
    const conn = freshConnection();
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.disconnect();
    expect(conn.hasReceivedSnapshot).toBe(false);
  });
});

describe("Connection respawn state", () => {
  it("derives a ceiling-rounded countdown from authoritative server ticks", () => {
    const conn = freshConnection();
    conn.serverTick = 41;
    conn.respawnAtTick = 141;
    expect(conn.respawnSecondsRemaining).toBe(5);
    conn.serverTick = 142;
    expect(conn.respawnSecondsRemaining).toBe(0);
  });

});

describe("Connection contextual action completion", () => {
  it("records attack and block presses so persistent combat help can dismiss", () => {
    const conn = freshConnection();
    conn.attack(1, 0);
    conn.sampleInput({
      moveX: 0,
      moveY: 0,
      jump: false,
      block: true,
    });
    expect([...conn.contextualActionsUsed]).toEqual(["attack", "block"]);
  });
});

describe("Connection rescue action", () => {
  it("sends the production rescue intent while alive, downed, or dead", () => {
    const conn = freshConnection();
    const send = vi.spyOn(conn, "send").mockImplementation(() => {});
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 30;

    conn.rescue();
    conn.downed = true;
    conn.rescue();
    conn.downed = false;
    conn.hp = 0;
    conn.rescue();

    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenNthCalledWith(1, { type: "rescue" });
    expect(send).toHaveBeenNthCalledWith(3, { type: "rescue" });
  });
});

describe("requireConnectionUpdate", () => {
  it("stops reconnecting and reports a terminal client-version mismatch", () => {
    const conn = freshConnection();
    const messages: string[] = [];
    conn.shouldReconnect = true;
    conn.onUpdateRequired = (message) => messages.push(message);

    requireConnectionUpdate(conn, "Refresh this client");

    expect(conn.updateRequired).toBe(true);
    expect(conn.shouldReconnect).toBe(false);
    expect(conn.status).toBe("closed");
    expect(messages).toEqual(["Refresh this client"]);
  });
});

describe("requireConnectionIdleTimeout", () => {
  it("stops reconnecting and retains a clear rejoin message", () => {
    const conn = freshConnection();
    conn.shouldReconnect = true;

    requireConnectionIdleTimeout(conn, "Disconnected after 3 minutes of inactivity.");

    expect(conn.shouldReconnect).toBe(false);
    expect(conn.sessionExpired).toBe(true);
    expect(conn.sessionEndMessage).toBe("Disconnected after 3 minutes of inactivity.");
    expect(conn.status).toBe("closed");
  });
});
