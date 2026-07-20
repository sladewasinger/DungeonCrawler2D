// Headless tests for Connection's derived getters — no socket/World needed since the
// constructor does no I/O and every field the getters read is a plain public property.
import { describe, expect, it } from "vitest";
import { Connection } from "./connection.js";

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

  it("is true once a real snapshot reported hp <= 0", () => {
    const conn = freshConnection();
    conn.status = "connected";
    conn.hasReceivedSnapshot = true;
    conn.hp = 0;
    expect(conn.dead).toBe(true);
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
