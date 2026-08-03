import { PROTOCOL_VERSION, type ClientHello, type ClientMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import type { GameSim } from "../sim/core/index.js";
import { routeAuthenticatedMessage } from "./messages/authenticatedMessage.js";
import { sendServerMessage } from "./telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "./telemetry/networkDiagnostics.js";
import { currentSocketOwnsPlayer } from "./socketAuthority.js";
import { dispatchAdminChatMessage, dispatchAdminMessage } from "./admin/dispatch.js";
import { isAdminMessage } from "./admin/adminMessageTypes.js";
import { recordMeaningfulGameplayActivity } from "./connection/activity/gameplayInactivity.js";
import { recordLiveAdminActivity } from "./connection/adminGameplayActivity.js";
import {
  type ServerConnectionMessageContext,
} from "./connection/connectionContext.js";
import { dispatchSpectatorMessage } from "./spectator/spectatorDispatch.js";
import { addJoinedPlayer, registerJoinedConnection, resolveJoinSim, sendJoinWelcome } from "./dispatchJoin.js";

/** Per-connection message routing: hello/resume, protocol check, and
 * handing off input/action messages to whichever sim currently owns
 * this player (which can change mid-session — Epic 7.14 floor transfers). */

export function dispatchMessage(msg: ClientMessage, context: ServerConnectionMessageContext): void {
  if (dispatchControlMessage(msg, context)) {
    recordLiveAdminActivity(msg, context);
    return;
  }
  if (msg.type === "chat" && dispatchAdminChatMessage(msg, context)) return;
  dispatchOwnedPlayerMessage(msg, context);
}

function dispatchOwnedPlayerMessage(
  msg: ClientMessage,
  context: ServerConnectionMessageContext,
): void {
  const { conn, sockets, ws } = context;
  if (!conn.playerId || !currentSocketOwnsPlayer(sockets, conn.playerId, ws)) return;
  const accepted = routeAuthenticatedMessage(msg, conn.playerId, sockets);
  if (accepted) recordMeaningfulGameplayActivity(conn, msg);
}

function dispatchControlMessage(msg: ClientMessage, context: ServerConnectionMessageContext): boolean {
  if (dispatchSpectatorMessage(msg, context)) return true;
  if (isAdminMessage(msg)) {
    dispatchAdminMessage(msg, context);
    return true;
  }
  if (msg.type === "hello") {
    void handleHello(msg, context);
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

async function handleHello(msg: ClientHello, context: ServerConnectionMessageContext): Promise<void> {
  const { floors, sandbox, combatSandbox, seedInputText, worldSeed } = context;
  if (!canAcceptHello(msg, context)) return;
  try {
    const sim = await resolveJoinSim(msg, { floors, sandbox, combatSandbox });
    const join = addJoinedPlayer(sim, msg);
    configureJoin(sim, join.playerId, msg);
    registerJoinedConnection({ context, msg, sim, join });
    sendJoinWelcome({ context, msg, sim, join, inputText: seedInputText ?? String(worldSeed) });
  } catch {
    context.conn.terminationReason = "floor_preparation_failed";
    context.ws.close(1011, "floor preparation failed");
  }
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
