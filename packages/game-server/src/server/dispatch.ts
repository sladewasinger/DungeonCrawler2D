import {
  LEVEL,
  PROTOCOL_VERSION,
  TICK_RATE,
  decodeClientMessage,
  type ClientHello,
  type ClientMessage,
  type LevelId,
} from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../floorRegistry.js";
import type { GameSim } from "../sim/index.js";
import type { ConnState, SocketMap } from "./types.js";
import { sendServerMessage } from "./measuredSend.js";
import type { ServerNetworkDiagnostics } from "./networkDiagnostics.js";

/** Per-connection message routing: hello/resume, protocol check, and
 * handing off input/action messages to whichever sim currently owns
 * this player (which can change mid-session — Epic 7.14 floor transfers). */

export function handleConnection(
  ws: WebSocket,
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  worldSeed: number,
  diagnostics: ServerNetworkDiagnostics,
): void {
  const conn: ConnState = { playerId: null };

  ws.on("message", (data) => {
    const raw = data.toString();
    const startedAt = performance.now();
    const msg = decodeClientMessage(raw);
    const decodedAt = performance.now();
    diagnostics.record(
      conn.playerId,
      "inbound",
      raw,
      decodedAt - startedAt,
      ws.bufferedAmount,
      decodedAt,
    );
    if (!msg) {
      if (conn.playerId === null) ws.close(1002, "bad message");
      return;
    }
    dispatchMessage(ws, msg, conn, floors, sandbox, sockets, worldSeed, diagnostics);
  });

  ws.on("close", () => {
    if (!conn.playerId) return;
    const entry = sockets.get(conn.playerId);
    if (entry?.ws === ws) {
      sockets.delete(conn.playerId);
      entry.sim.markDisconnected(conn.playerId);
      diagnostics.removeClient(conn.playerId);
    }
  });
}

function dispatchMessage(
  ws: WebSocket,
  msg: ClientMessage,
  conn: ConnState,
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  worldSeed: number,
  diagnostics: ServerNetworkDiagnostics,
): void {
  if (msg.type === "hello") {
    handleHello(ws, msg, conn, floors, sandbox, sockets, worldSeed, diagnostics);
    return;
  }
  if (msg.type === "ping") {
    sendServerMessage(ws, conn.playerId, { type: "pong", t: msg.t }, diagnostics);
    return;
  }
  if (conn.playerId) routeAuthenticatedMessage(msg, conn.playerId, sockets);
}

export function routeAuthenticatedMessage(
  msg: ClientMessage,
  playerId: string,
  sockets: SocketMap,
): void {
  const entry = sockets.get(playerId);
  if (!entry) return;
  if (msg.type === "snapshotResync") entry.sim.requestSnapshotBaseline(playerId);
  else if (msg.type === "input") entry.sim.handleInput(playerId, msg);
  else if (msg.type !== "hello" && msg.type !== "ping") entry.sim.queueAction(playerId, msg);
}

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

function handleHello(
  ws: WebSocket,
  msg: ClientHello,
  conn: ConnState,
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  worldSeed: number,
  diagnostics: ServerNetworkDiagnostics,
): void {
  if (conn.playerId !== null) return;
  if (msg.protocol !== PROTOCOL_VERSION) {
    rejectProtocolMismatch(ws, diagnostics);
    return;
  }
  const sim = resolveJoinSim(msg, floors, sandbox);
  const join = sim.addPlayer(msg.name, msg.clientId, msg.resumeToken, msg.skin);
  sim.configureSnapshotMode(join.playerId, msg.snapshotMode);
  conn.playerId = join.playerId;
  const previous = sockets.get(join.playerId);
  sockets.set(join.playerId, { ws, sim });
  if (previous && previous.ws !== ws) previous.ws.close(1000, "resumed elsewhere");
  sendWelcome(ws, join, msg.level, worldSeed, diagnostics);
}

function rejectProtocolMismatch(
  ws: WebSocket,
  diagnostics: ServerNetworkDiagnostics,
): void {
  sendServerMessage(
    ws,
    null,
    {
      type: "error",
      code: "protocol_mismatch",
      message: `server speaks protocol ${PROTOCOL_VERSION}`,
    },
    diagnostics,
  );
  ws.close(1002, "protocol mismatch");
}

function sendWelcome(
  ws: WebSocket,
  join: ReturnType<GameSim["addPlayer"]>,
  level: LevelId,
  worldSeed: number,
  diagnostics: ServerNetworkDiagnostics,
): void {
  sendServerMessage(
    ws,
    join.playerId,
    {
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      playerId: join.playerId,
      resumeToken: join.resumeToken,
      worldSeed,
      floor: join.floor,
      level,
      tickRate: TICK_RATE,
      spawn: join.spawn,
    },
    diagnostics,
  );
}
