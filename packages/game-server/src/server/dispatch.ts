import {
  LEVEL,
  PROTOCOL_VERSION,
  TICK_RATE,
  decodeClientMessage,
  encodeMessage,
  type ClientHello,
  type ClientMessage,
  type LevelId,
} from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../floorRegistry.js";
import type { GameSim } from "../sim/index.js";
import type { ConnState, SocketMap } from "./types.js";

/** Per-connection message routing: hello/resume, protocol check, and
 * handing off input/action messages to whichever sim currently owns
 * this player (which can change mid-session — Epic 7.14 floor transfers). */

export function handleConnection(
  ws: WebSocket,
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  worldSeed: number,
): void {
  const conn: ConnState = { playerId: null };

  ws.on("message", (data) => {
    const msg = decodeClientMessage(data.toString());
    if (!msg) {
      if (conn.playerId === null) ws.close(1002, "bad message");
      return;
    }
    dispatchMessage(ws, msg, conn, floors, sandbox, sockets, worldSeed);
  });

  ws.on("close", () => {
    if (!conn.playerId) return;
    const entry = sockets.get(conn.playerId);
    if (entry?.ws === ws) {
      sockets.delete(conn.playerId);
      entry.sim.markDisconnected(conn.playerId);
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
): void {
  if (msg.type === "hello") {
    handleHello(ws, msg, conn, floors, sandbox, sockets, worldSeed);
    return;
  }
  if (msg.type === "ping") {
    ws.send(encodeMessage({ type: "pong", t: msg.t }));
    return;
  }
  const entry = conn.playerId ? sockets.get(conn.playerId) : undefined;
  if (!entry) return;
  if (msg.type === "input") entry.sim.handleInput(conn.playerId as string, msg);
  else entry.sim.queueAction(conn.playerId as string, msg);
}

/** Which sim a hello lands in: sandbox is unchanged; a dungeon resume
 * reattaches wherever its slot currently lives (any active floor); a
 * fresh dungeon join honors `floor` (clamped), defaulting to 1. */
function resolveJoinSim(msg: ClientHello, floors: FloorRegistry, sandbox: GameSim): GameSim {
  if (msg.level === LEVEL.Sandbox) return sandbox;
  if (msg.resumeToken) {
    const resumed = floors.findByToken(msg.resumeToken);
    if (resumed) return resumed;
  }
  return floors.ensureFloor(msg.floor ?? 1);
}

function handleHello(
  ws: WebSocket,
  msg: ClientHello,
  conn: ConnState,
  floors: FloorRegistry,
  sandbox: GameSim,
  sockets: SocketMap,
  worldSeed: number,
): void {
  if (conn.playerId !== null) return;
  if (msg.protocol !== PROTOCOL_VERSION) {
    rejectProtocolMismatch(ws);
    return;
  }
  const sim = resolveJoinSim(msg, floors, sandbox);
  const join = sim.addPlayer(msg.name, msg.clientId, msg.resumeToken);
  conn.playerId = join.playerId;
  const previous = sockets.get(join.playerId);
  if (previous && previous.ws !== ws) previous.ws.close(1000, "resumed elsewhere");
  sockets.set(join.playerId, { ws, sim });
  sendWelcome(ws, join, msg.level, worldSeed);
}

function rejectProtocolMismatch(ws: WebSocket): void {
  ws.send(
    encodeMessage({
      type: "error",
      code: "protocol_mismatch",
      message: `server speaks protocol ${PROTOCOL_VERSION}`,
    }),
  );
  ws.close(1002, "protocol mismatch");
}

function sendWelcome(
  ws: WebSocket,
  join: ReturnType<GameSim["addPlayer"]>,
  level: LevelId,
  worldSeed: number,
): void {
  ws.send(
    encodeMessage({
      type: "welcome",
      protocol: PROTOCOL_VERSION,
      playerId: join.playerId,
      resumeToken: join.resumeToken,
      worldSeed,
      floor: join.floor,
      level,
      tickRate: TICK_RATE,
      spawn: join.spawn,
    }),
  );
}
