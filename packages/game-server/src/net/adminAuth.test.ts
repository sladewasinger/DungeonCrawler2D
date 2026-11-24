import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { ServerMessageSchema, type ServerMessage } from "@dc2d/engine";
import { WorldSim } from "../sim/worldSim.js";
import { attemptAdminAuth, resolveAdminAuthConfig, verifyAdminToken } from "./adminAuth.js";
import { attachClient, type ClientSession } from "./wsServer.js";

const PROD_TOKEN = "prod-admin-secret-999";

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly sent: ServerMessage[] = [];
  send(raw: string): void { this.sent.push(ServerMessageSchema.parse(JSON.parse(raw))); }
  ping(): void {}
  terminate(): void { this.readyState = WebSocket.CLOSED; this.emit("close"); }
  lastSnapshot(): Extract<ServerMessage, { t: "snapshot" }> {
    const snaps = this.sent.filter((m): m is Extract<ServerMessage, { t: "snapshot" }> => m.t === "snapshot");
    const last = snaps.at(-1);
    if (!last) throw new Error("No snapshot received");
    return last;
  }
}

function sendJsonMsg(ws: FakeSocket, payload: unknown): void {
  ws.emit("message", Buffer.from(JSON.stringify(payload)));
}

function sendPrivilegedBatch(ws: FakeSocket, baseSeq: number): void {
  sendJsonMsg(ws, { t: "admin", action: "godMode", enabled: true, seq: baseSeq });
  sendJsonMsg(ws, { t: "debugSpawn", kind: "spider", count: 1, seq: baseSeq + 1 });
  sendJsonMsg(ws, { t: "setDayPhase", dayPhase: 0.95, paused: true, seq: baseSeq + 2 });
}

function hasSpider(snap: Extract<ServerMessage, { t: "snapshot" }>): boolean {
  return Boolean(snap.entities && snap.entities.some((e) => e.kind === "spider"));
}

describe("adminAuth gating & session auth", () => {
  it("disables open admin in production or DEBUG_COMMANDS=0 and locks out brute-force tokens", () => {
    expect(resolveAdminAuthConfig({ NODE_ENV: "development" })).toEqual({ allowOpenDevAdmin: true, adminToken: "" });
    expect(resolveAdminAuthConfig({ NODE_ENV: "production", ADMIN_TOKEN: "  tok  " })).toEqual({ allowOpenDevAdmin: false, adminToken: "tok" });
    expect(resolveAdminAuthConfig({ NODE_ENV: "development", DEBUG_COMMANDS: "0", ADMIN_TOKEN: "tok" })).toEqual({ allowOpenDevAdmin: false, adminToken: "tok" });

    expect(verifyAdminToken("abc", "abc")).toBe(true);
    expect(verifyAdminToken("abc", "abcd")).toBe(false);
    expect(verifyAdminToken("", "abc")).toBe(false);

    const cfg = { allowOpenDevAdmin: false, adminToken: PROD_TOKEN };
    const s = { isAdmin: false, failedAuthAttempts: 0 };
    for (let i = 0; i < 5; i++) expect(attemptAdminAuth(s, `bad-${i}`, cfg)).toBe(false);
    expect(attemptAdminAuth(s, PROD_TOKEN, cfg)).toBe(false);
    expect(s.isAdmin).toBe(false);
  });

  it("blocks unauthenticated admin/debugSpawn/setDayPhase on wsServer and unlocks after valid ADMIN_TOKEN", () => {
    const sim = new WorldSim(1337);
    const clients = new Map<WebSocket, ClientSession>();
    const ws = new FakeSocket();
    attachClient({ ws: ws as unknown as WebSocket, sim, clients, authConfig: { allowOpenDevAdmin: false, adminToken: PROD_TOKEN } });
    expect(clients.size).toBe(1);

    sendJsonMsg(ws, { t: "hello", version: 1, name: "ProdUser" });
    const initial = ws.lastSnapshot();
    expect(initial.selfAdmin).toBeUndefined();

    sendPrivilegedBatch(ws, 1);
    const blocked = ws.lastSnapshot();
    expect(blocked.selfAdmin).toBeUndefined();
    expect(blocked.players[0]?.godMode).toBeUndefined();
    expect(blocked.entities).toHaveLength((initial.entities ?? []).length);
    expect(hasSpider(blocked)).toBe(false);
    expect(blocked.dayPaused).toBe(false);

    sendJsonMsg(ws, { t: "admin", action: "auth", token: "wrong-token", seq: 4 });
    expect(ws.lastSnapshot().selfAdmin).toBeUndefined();

    sendJsonMsg(ws, { t: "admin", action: "auth", token: PROD_TOKEN, seq: 5 });
    expect(ws.lastSnapshot().selfAdmin).toBe(true);

    sendPrivilegedBatch(ws, 6);
    const allowed = ws.lastSnapshot();
    expect(allowed.players[0]?.godMode).toBe(true);
    expect(hasSpider(allowed)).toBe(true);
    expect(allowed.dayPhase).toBeCloseTo(0.95, 2);
    expect(allowed.dayPaused).toBe(true);

    ws.emit("close");
    expect(clients.size).toBe(0);
    expect(sim.snapshots()).toHaveLength(0);
  });
});
