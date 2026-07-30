import {
  LEVEL,
  PROTOCOL_VERSION,
  decodeClientMessage,
  type ClientHello,
  type ClientMessage,
} from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../floors/floorRegistry.js";
import type { GameSim } from "../sim/core/index.js";
import type { ConnState, SocketMap } from "./types.js";
import { routeAuthenticatedMessage } from "./authenticatedMessage.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import { currentSocketOwnsPlayer } from "./socketAuthority.js";
import { sendWelcome } from "./welcome.js";

interface ConnectionContext {
  floors: FloorRegistry;
  sandbox: GameSim;
  sockets: SocketMap;
  seedInputText?: string;
  worldSeed: number;
  diagnostics: ServerNetworkDiagnostics;
}

interface ConnectionMessageContext extends ConnectionContext {
  ws: WebSocket;
  conn: ConnState;
}

/** Per-connection message routing: hello/resume, protocol check, and
 * handing off input/action messages to whichever sim currently owns
 * this player (which can change mid-session — Epic 7.14 floor transfers). */

export function handleConnection(ws: WebSocket, context: ConnectionContext): void {
  const conn: ConnState = { playerId: null };
  const messageContext = { ws, conn, ...context };
  ws.on("message", (data) => receiveMessage(data.toString(), messageContext));
  ws.on("close", () => disconnectSocket({ ws, conn, sockets: context.sockets, diagnostics: context.diagnostics }));
}

function receiveMessage(raw: string, context: ConnectionMessageContext): void {
  const startedAt = performance.now();
  const msg = decodeClientMessage(raw);
  const decodedAt = performance.now();
  recordInbound({ raw, codecMilliseconds: decodedAt - startedAt, nowMs: decodedAt, context });
  if (msg) dispatchMessage(msg, context);
  else closeUnauthenticatedSocket(context.ws, context.conn);
}

interface InboundRecord {
  raw: string;
  codecMilliseconds: number;
  nowMs: number;
  context: ConnectionMessageContext;
}

function recordInbound({ raw, codecMilliseconds, nowMs, context }: InboundRecord): void {
  context.diagnostics.record({
    playerId: context.conn.playerId,
    direction: "inbound",
    payload: raw,
    codecMilliseconds,
    queueBytes: context.ws.bufferedAmount,
    nowMs,
  });
}

function closeUnauthenticatedSocket(ws: WebSocket, conn: ConnState): void {
  if (conn.playerId === null) ws.close(1002, "bad message");
}

interface DisconnectContext {
  ws: WebSocket;
  conn: ConnState;
  sockets: SocketMap;
  diagnostics: ServerNetworkDiagnostics;
}

function disconnectSocket({ ws, conn, sockets, diagnostics }: DisconnectContext): void {
  if (!conn.playerId) return;
  const entry = sockets.get(conn.playerId);
  if (entry?.ws !== ws) return;
  sockets.delete(conn.playerId);
  entry.sim.markDisconnected(conn.playerId);
  diagnostics.removeClient(conn.playerId);
}

function dispatchMessage(msg: ClientMessage, context: ConnectionMessageContext): void {
  const { ws, conn, sockets, diagnostics } = context;
  if (msg.type === "hello") {
    handleHello(msg, context);
    return;
  }
  if (msg.type === "ping") {
    sendServerMessage({ socket: ws, playerId: conn.playerId, message: { type: "pong", t: msg.t }, diagnostics });
    return;
  }
  if (conn.playerId && currentSocketOwnsPlayer(sockets, conn.playerId, ws)) {
    routeAuthenticatedMessage(msg, conn.playerId, sockets);
  }
}

export { routeAuthenticatedMessage } from "./authenticatedMessage.js";

/** Which sim a hello lands in: sandbox is unchanged; a dungeon resume
 * reattaches wherever its slot currently lives (any active floor); a
 * fresh process/session join restores the server-owned active floor. */
function resolveJoinSim(msg: ClientHello, floors: FloorRegistry, sandbox: GameSim): GameSim {
  if (msg.level === LEVEL.Sandbox) return sandbox;
  if (msg.resumeToken) {
    const resumed = floors.findByToken(msg.resumeToken);
    if (resumed) return resumed;
  }
  return floors.joinSim(msg.clientId);
}

function handleHello(msg: ClientHello, context: ConnectionMessageContext): void {
  const { ws, conn, floors, sandbox, sockets, seedInputText, worldSeed, diagnostics } = context;
  const inputText = seedInputText ?? String(worldSeed);
  if (conn.playerId !== null) return;
  if (msg.protocol !== PROTOCOL_VERSION) {
    rejectProtocolMismatch(ws, diagnostics);
    return;
  }
  const sim = resolveJoinSim(msg, floors, sandbox);
  const join = sim.addPlayer({ name: msg.name, clientId: msg.clientId, resumeToken: msg.resumeToken, skin: msg.skin });
  sim.configureSnapshotMode(join.playerId, msg.snapshotMode);
  if (msg.networkProfile !== undefined) {
    sim.configureNetworkProfile(join.playerId, msg.networkProfile);
  }
  conn.playerId = join.playerId;
  const previous = sockets.get(join.playerId);
  sockets.set(join.playerId, { ws, sim });
  if (previous && previous.ws !== ws) previous.ws.close(1000, "resumed elsewhere");
  sendWelcome({
    ws, join, level: msg.level, seedInputText: inputText, worldSeed,
    worldFeatures: sim.world.features, diagnostics,
  });
}

function rejectProtocolMismatch(ws: WebSocket, diagnostics: ServerNetworkDiagnostics): void {
  sendServerMessage({
    socket: ws,
    playerId: null,
    message: {
      type: "error",
      code: "protocol_mismatch",
      message: `server speaks protocol ${PROTOCOL_VERSION}`,
    },
    diagnostics,
  });
  ws.close(1002, "protocol mismatch");
}
