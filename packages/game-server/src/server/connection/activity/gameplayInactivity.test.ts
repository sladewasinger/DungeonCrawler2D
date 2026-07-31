import {
  decodeServerMessage,
  type ClientInput,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { newSpectatorSession } from "../../admin/spectator/spectatorSession.js";
import type { ConnState, SocketMap } from "../../types.js";
import {
  expireInactiveGameplayConnections,
  recordMeaningfulGameplayActivity,
} from "./gameplayInactivity.js";

class FakeSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  closeCode: number | undefined;
  closeReason: string | undefined;
  readonly sent: string[] = [];

  send(message: string): void {
    this.sent.push(message);
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = WebSocket.CLOSED;
  }
}

function connection(lastMeaningfulActivityAt: number | null): ConnState {
  return {
    playerId: "player-1",
    lastMeaningfulActivityAt,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: null,
    adminSession: null,
    peerAddress: "127.0.0.1",
    spectator: newSpectatorSession(),
  };
}

function neutralInput(faceX?: number, faceY?: number): ClientInput {
  return {
    type: "input",
    seq: 1,
    projectedServerTick: 0,
    moveX: 0,
    moveY: 0,
    jump: false,
    run: false,
    ...(faceX === undefined ? {} : { faceX }),
    ...(faceY === undefined ? {} : { faceY }),
  };
}

describe("gameplay inactivity", () => {
  it("does not refresh an idle lease for neutral heartbeats or pings", () => {
    const conn = connection(10);

    recordMeaningfulGameplayActivity(conn, neutralInput(), 20);
    recordMeaningfulGameplayActivity(conn, neutralInput(1, 0), 30);
    recordMeaningfulGameplayActivity(conn, neutralInput(1, 0), 40);
    recordMeaningfulGameplayActivity(conn, { type: "ping", t: 50 }, 50);

    expect(conn.lastMeaningfulActivityAt).toBe(10);
  });

  it("refreshes an idle lease for movement, running, jumping, and blocking", () => {
    const conn = connection(10);

    recordMeaningfulGameplayActivity(conn, { ...neutralInput(), moveX: 1 }, 20);
    recordMeaningfulGameplayActivity(conn, { ...neutralInput(), run: true }, 30);
    recordMeaningfulGameplayActivity(conn, { ...neutralInput(), jump: true }, 40);
    recordMeaningfulGameplayActivity(conn, { ...neutralInput(), block: true }, 50);

    expect(conn.lastMeaningfulActivityAt).toBe(50);
  });

  it("refreshes an idle lease for aim changes, chat, and gameplay actions", () => {
    const conn = connection(10);
    conn.lastAim = { x: 1, y: 0 };

    recordMeaningfulGameplayActivity(conn, neutralInput(0, 1), 20);
    recordMeaningfulGameplayActivity(conn, { type: "chat", channel: "local", text: "ready" }, 30);
    recordMeaningfulGameplayActivity(conn, { type: "attack", dirX: 1, dirY: 0 }, 40);

    expect(conn.lastMeaningfulActivityAt).toBe(40);
  });

  it("does not refresh an idle lease for tick-resolved no-op intents", () => {
    const conn = connection(10);

    recordMeaningfulGameplayActivity(conn, { type: "pickup" }, 20);
    recordMeaningfulGameplayActivity(conn, { type: "interact" }, 30);
    recordMeaningfulGameplayActivity(conn, { type: "craft", recipe: "bandage" }, 40);
    recordMeaningfulGameplayActivity(conn, { type: "stash", op: "take", index: 0 }, 50);

    expect(conn.lastMeaningfulActivityAt).toBe(10);
  });

  it("disconnects only inactive gameplay players with a specific idle reason", () => {
    const playerSocket = new FakeSocket();
    const adminSocket = new FakeSocket();
    const player = connection(10);
    const admin = connection(10);
    admin.playerId = null;
    const sockets: SocketMap = new Map([
      ["player-1", { ws: playerSocket as unknown as WebSocket, sim: {} as never, conn: player }],
      ["admin", { ws: adminSocket as unknown as WebSocket, sim: {} as never, conn: admin }],
    ]);

    expireInactiveGameplayConnections({ sockets, diagnostics: undefined, now: 190, timeoutMs: 180 });

    const timeout = decodeServerMessage(playerSocket.sent[0] ?? "");
    expect(timeout).toMatchObject({ type: "error", code: "idle_timeout" });
    expect(playerSocket.closeCode).toBe(4000);
    expect(playerSocket.closeReason).toBe("idle_timeout");
    expect(adminSocket.sent).toEqual([]);
    expect(adminSocket.closeCode).toBeUndefined();
  });
});
