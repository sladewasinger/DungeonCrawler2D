import {
  LEVEL,
  PROTOCOL_VERSION,
  decodeServerMessage,
  encodeMessage,
  type ClientHello,
  type ClientMessage,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { FloorRegistry } from "../floorRegistry.js";
import { content, makeSim } from "../sim/integration/support.js";
import { PlayerStore } from "../store.js";
import { deliverSnapshots } from "./broadcast.js";
import { handleConnection } from "./dispatch.js";
import { ServerNetworkDiagnostics } from "./networkDiagnostics.js";
import type { SocketMap } from "./types.js";

type Listener = (data?: string) => void;

class FakeSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 77;
  readonly sent: string[] = [];
  readonly listeners = new Map<string, Listener>();

  on(event: string, listener: Listener): void {
    this.listeners.set(event, listener);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.listeners.get("close")?.();
  }

  receive(message: ClientMessage): void {
    this.listeners.get("message")?.(encodeMessage(message));
  }
}

function hello(protocol = PROTOCOL_VERSION, resumeToken?: string): ClientHello {
  return {
    type: "hello",
    protocol,
    name: "Tester",
    clientId: "diagnostic-client",
    level: LEVEL.Sandbox,
    snapshotMode: "delta-v1",
    ...(resumeToken ? { resumeToken } : {}),
  };
}

function welcome(socket: FakeSocket): { playerId: string; resumeToken: string } {
  const message = decodeServerMessage(socket.sent.at(-1) ?? "");
  if (message?.type !== "welcome") throw new Error("expected welcome");
  return message;
}

function wireTypes(socket: FakeSocket): string[] {
  return socket.sent.map((payload) => decodeServerMessage(payload)?.type ?? "invalid");
}

describe("server network diagnostics wiring", () => {
  it("measures welcome, pong, snapshot, and protocol-error sends through fake sockets", () => {
    const store = new PlayerStore(null);
    const floors = new FloorRegistry(123, content, store, 1, { testFixtures: true });
    const sandbox = makeSim();
    const diagnostics = new ServerNetworkDiagnostics();
    const sockets: SocketMap = new Map();
    const accepted = new FakeSocket();
    handleConnection(
      accepted as unknown as WebSocket,
      floors,
      sandbox,
      sockets,
      123,
      diagnostics,
    );
    accepted.receive(hello());
    accepted.receive({ type: "ping", t: 4 });
    deliverSnapshots(sandbox.stepPreparedReplicated(), sockets, diagnostics);

    const rejected = new FakeSocket();
    handleConnection(
      rejected as unknown as WebSocket,
      floors,
      sandbox,
      sockets,
      123,
      diagnostics,
    );
    rejected.receive(hello(PROTOCOL_VERSION + 1));

    expect(wireTypes(accepted)).toEqual(["welcome", "pong", "snapshotDelta"]);
    expect(wireTypes(rejected)).toEqual(["error"]);
    const measured = diagnostics.snapshot(performance.now() + 1000);
    expect(measured.server.inboundMessagesPerSecond).toBeCloseTo(3, 0);
    expect(measured.server.outboundMessagesPerSecond).toBeCloseTo(4, 0);
    expect(measured.server.inboundBytesPerSecond).toBeGreaterThan(0);
    expect(measured.server.outboundBytesPerSecond).toBeGreaterThan(0);
    expect(measured.server.encodeMilliseconds).toBeGreaterThanOrEqual(0);
    expect(measured.server.decodeMilliseconds).toBeGreaterThanOrEqual(0);
    expect(measured.server.maximumQueueBytes).toBe(77);
  });

  it("keeps a replacement client's diagnostics until its current socket closes", () => {
    const store = new PlayerStore(null);
    const floors = new FloorRegistry(123, content, store, 1, { testFixtures: true });
    const sandbox = makeSim();
    const diagnostics = new ServerNetworkDiagnostics();
    const sockets: SocketMap = new Map();
    const first = new FakeSocket();
    handleConnection(first as unknown as WebSocket, floors, sandbox, sockets, 123, diagnostics);
    first.receive(hello());
    const joined = welcome(first);
    sandbox.markDisconnected(joined.playerId);

    const replacement = new FakeSocket();
    handleConnection(replacement as unknown as WebSocket, floors, sandbox, sockets, 123, diagnostics);
    replacement.receive(hello(PROTOCOL_VERSION, joined.resumeToken));

    expect(sockets.get(joined.playerId)?.ws).toBe(replacement);
    const measured = diagnostics.snapshot(performance.now() + 1000).clients.get(joined.playerId);
    expect(measured?.outboundMessagesPerSecond).toBeGreaterThan(1.5);
    replacement.receive({ type: "input", seq: 1, projectedServerTick: sandbox.tick, moveX: 1, moveY: 0, jump: false, run: false });
    sandbox.step();
    expect(sandbox.getPlayerEntity(joined.playerId)?.facing).toEqual({ x: 1, y: 0 });

    replacement.close();

    expect(sockets.has(joined.playerId)).toBe(false);
    expect(diagnostics.snapshot(performance.now() + 1000).clients.has(joined.playerId)).toBe(false);
  });
});
