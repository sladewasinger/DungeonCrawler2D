import { EventEmitter } from "node:events";
import { ServerMessageSchema, type ServerMessage } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { WorldSim } from "../sim/worldSim.js";
import {
  IpConnectionLimiter, PacketRateLimiter, extractClientIp, isAllowedWsOrigin,
} from "./wsSecurity.js";
import { attachClient, type ClientSession } from "./wsServer.js";

class MockSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  readonly sent: ServerMessage[] = [];
  closedWith: { readonly code?: number | undefined; readonly reason?: string | undefined } | null = null;
  send(raw: string): void { this.sent.push(ServerMessageSchema.parse(JSON.parse(raw))); }
  ping(): void {}
  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }
  terminate(): void { this.readyState = WebSocket.CLOSED; this.emit("close"); }
}

const sendMsg = (ws: MockSocket, payload: unknown): void => {
  ws.emit("message", Buffer.from(JSON.stringify(payload)));
};

const EMPTY_AUTH = { allowOpenDevAdmin: false, adminToken: "" };

describe("wsSecurity & single-session resume auth", () => {
  it("enforces Origin allowlists, Fly proxy IP opt-in, per-IP caps, and packet rate limits", () => {
    expect(isAllowedWsOrigin("https://dungeoncrawl2d.austinwasinger.com", { NODE_ENV: "production" })).toBe(true);
    expect(isAllowedWsOrigin("https://evil.example", { NODE_ENV: "production" })).toBe(false);
    expect(isAllowedWsOrigin(undefined, { NODE_ENV: "production" })).toBe(false);
    expect(isAllowedWsOrigin(undefined, { NODE_ENV: "development" })).toBe(true);
    expect(isAllowedWsOrigin("http://192.168.1.42:5173", { NODE_ENV: "development" })).toBe(true);
    expect(isAllowedWsOrigin("https://custom.example", { NODE_ENV: "production", ALLOWED_WS_ORIGINS: "https://custom.example" })).toBe(true);

    const fakeReq = { headers: { "fly-client-ip": "203.0.113.9" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as Parameters<typeof extractClientIp>[0];
    expect(extractClientIp(fakeReq, { NODE_ENV: "production" })).toBe("127.0.0.1");
    expect(extractClientIp(fakeReq, { NODE_ENV: "production", TRUST_FLY_PROXY: "1" })).toBe("203.0.113.9");

    const ips = new IpConnectionLimiter();
    for (let i = 0; i < 4; i++) expect(ips.tryAcquire("1.2.3.4")).toBe(true);
    expect(ips.tryAcquire("1.2.3.4")).toBe(false);
    ips.release("1.2.3.4");
    expect(ips.tryAcquire("1.2.3.4")).toBe(true);

    const limiter = new PacketRateLimiter();
    for (let i = 0; i < 120; i++) expect(limiter.allow(1000)).toBe(true);
    expect(limiter.allow(1000)).toBe(false);
    expect(limiter.allow(1200)).toBe(true);
  });

  it("resumes player identity cleanly with valid token and evicts superseded session", () => {
    const sim = new WorldSim(1337);
    const clients = new Map<WebSocket, ClientSession>();

    const first = new MockSocket();
    attachClient({ ws: first as unknown as WebSocket, sim, clients, authConfig: EMPTY_AUTH });
    sendMsg(first, { t: "hello", version: 1, name: "Ranger" });
    const w1 = first.sent.find((m): m is Extract<ServerMessage, { t: "welcome" }> => m.t === "welcome")!;
    expect(w1.accountId).toMatch(/^acc_/);
    expect(w1.resumeToken).toBeTruthy();

    const forged = new MockSocket();
    attachClient({ ws: forged as unknown as WebSocket, sim, clients, authConfig: EMPTY_AUTH });
    sendMsg(forged, { t: "hello", version: 1, name: "Ranger", accountId: w1.accountId, resumeToken: "bad-token-0123456789abcd" });
    const wForged = forged.sent.find((m): m is Extract<ServerMessage, { t: "welcome" }> => m.t === "welcome")!;
    expect(wForged.accountId).not.toBe(w1.accountId);
    expect(first.closedWith).toBeNull();
    forged.close();

    const reconnect = new MockSocket();
    attachClient({ ws: reconnect as unknown as WebSocket, sim, clients, authConfig: EMPTY_AUTH });
    sendMsg(reconnect, { t: "hello", version: 1, name: "RangerV2", accountId: w1.accountId, resumeToken: w1.resumeToken });
    const w2 = reconnect.sent.find((m): m is Extract<ServerMessage, { t: "welcome" }> => m.t === "welcome")!;
    expect(w2.playerId).toBeTruthy();
    expect(w2.accountId).toBeUndefined();
    expect(first.closedWith?.code).toBe(4001);
    expect(sim.snapshots()).toHaveLength(1);
    expect(sim.snapshots()[0]?.name).toBe("RangerV2");
  });
});
