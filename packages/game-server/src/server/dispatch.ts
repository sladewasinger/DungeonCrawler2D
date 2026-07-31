import {
  LEVEL,
  PROTOCOL_VERSION,
  type ClientHello,
  type ClientMessage,
} from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../floors/floorRegistry.js";
import type { GameSim } from "../sim/core/index.js";
import type { ConnState } from "./types.js";
import { routeAuthenticatedMessage } from "./messages/authenticatedMessage.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import { currentSocketOwnsPlayer } from "./socketAuthority.js";
import { sendWelcome } from "./welcome.js";
import { dispatchAdminChatMessage, dispatchAdminMessage } from "./admin/dispatch.js";
import { isAdminMessage } from "./admin/adminMessageTypes.js";
import {
  recordMeaningfulGameplayActivity,
  startGameplayActivity,
} from "./connection/activity/gameplayInactivity.js";
import { recordLiveAdminActivity } from "./connection/adminGameplayActivity.js";
import { recordConnectionJoined } from "./connection/connectionLifecycle.js";
import {
  type ServerConnectionMessageContext,
} from "./connection/connectionContext.js";

/** Per-connection message routing: hello/resume, protocol check, and
 * handing off input/action messages to whichever sim currently owns
 * this player (which can change mid-session — Epic 7.14 floor transfers). */

export function dispatchMessage(msg: ClientMessage, context: ServerConnectionMessageContext): void {
  const { ws, conn, sockets } = context;
  if (dispatchControlMessage(msg, context)) {
    recordLiveAdminActivity(msg, context);
    return;
  }
  const playerOwnsSocket = conn.playerId !== null &&
    currentSocketOwnsPlayer(sockets, conn.playerId, ws);
  if (playerOwnsSocket) recordMeaningfulGameplayActivity(conn, msg);
  if (msg.type === "chat" && dispatchAdminChatMessage(msg, context)) return;
  if (conn.playerId && playerOwnsSocket) {
    routeAuthenticatedMessage(msg, conn.playerId, sockets);
  }
}

function dispatchControlMessage(msg: ClientMessage, context: ServerConnectionMessageContext): boolean {
  if (isAdminMessage(msg)) {
    dispatchAdminMessage(msg, context);
    return true;
  }
  if (msg.type === "hello") {
    handleHello(msg, context);
    return true;
  }
  if (msg.type === "ping") {
    sendServerMessage({ socket: context.ws, playerId: context.conn.playerId, message: { type: "pong", t: msg.t }, diagnostics: context.diagnostics });
    return true;
  }
  return false;
}

export { routeAuthenticatedMessage } from "./messages/authenticatedMessage.js";
export { handleConnection } from "./connection/connectionHandler.js";

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

function handleHello(msg: ClientHello, context: ServerConnectionMessageContext): void {
  const { ws, conn, floors, sandbox, sockets, seedInputText, worldSeed, diagnostics } = context;
  const inputText = seedInputText ?? String(worldSeed);
  if (!canAcceptHello(msg, context)) return;
  const sim = resolveJoinSim(msg, floors, sandbox);
  const join = sim.addPlayer({
    name: msg.name,
    clientId: msg.clientId,
    resumeToken: msg.resumeToken,
    skin: msg.skin,
    clientMetadata: msg.clientMetadata,
  });
  configureJoin(sim, join.playerId, msg);
  conn.playerId = join.playerId;
  startGameplayActivity(conn);
  // Admin sessions are created only after the connection proves the server
  // token through adminAuth. Client-controlled hello identity is not a
  // credential, even when its stored profile has an admin grant.
  conn.adminSession = null;
  const previous = sockets.get(join.playerId);
  sockets.set(join.playerId, { ws, sim, conn });
  closePreviousSocket(previous, ws);
  recordConnectionJoined({
    events: context.operationalEvents,
    conn,
    playerId: join.playerId,
    level: msg.level,
    resumed: join.resumed,
  });
  sendWelcome({
    ws, join, level: msg.level, seedInputText: inputText, worldSeed,
    worldFeatures: sim.world.features, diagnostics,
  });
}

function canAcceptHello(msg: ClientHello, context: ServerConnectionMessageContext): boolean {
  if (context.conn.playerId !== null) return false;
  if (msg.protocol === PROTOCOL_VERSION) return true;
  context.conn.terminationReason = "protocol_mismatch";
  rejectProtocolMismatch(context.ws, context.diagnostics);
  return false;
}

function configureJoin(sim: GameSim, playerId: string, msg: ClientHello): void {
  sim.configureSnapshotMode(playerId, msg.snapshotMode);
  if (msg.networkProfile !== undefined) sim.configureNetworkProfile(playerId, msg.networkProfile);
}

function closePreviousSocket(previous: { ws: WebSocket; conn?: ConnState } | undefined, current: WebSocket): void {
  if (!previous || previous.ws === current) return;
  if (previous.conn) previous.conn.terminationReason = "resumed_elsewhere";
  previous.ws.close(1000, "resumed elsewhere");
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
