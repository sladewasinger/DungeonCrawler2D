import type { ServerMessage } from "@dc2d/engine";
import type { WebSocket } from "ws";
import { sendServerMessage } from "../../telemetry/measuredSend.js";
import type { ServerNetworkDiagnostics } from "../../telemetry/networkDiagnostics.js";
import type { ConnState } from "../../types.js";
import type { AdminController } from "../controller.js";
import type { AdminSessionRegistry } from "../access/sessionRegistry.js";

const ADMIN_STATE_INTERVAL_MS = 250;

/** Authenticated control-surface sockets that should receive live state. */
export class AdminStateSubscriptions {
  private readonly connections = new Map<WebSocket, ConnState>();
  private lastBroadcastAt = 0;

  constructor(private readonly sessions: AdminSessionRegistry) {}

  add(socket: WebSocket, connection: ConnState): void {
    this.connections.set(socket, connection);
  }

  remove(socket: WebSocket): void {
    this.connections.delete(socket);
  }

  broadcast(
    controller: AdminController,
    diagnostics: ServerNetworkDiagnostics | undefined,
    now = Date.now(),
  ): void {
    if (now - this.lastBroadcastAt < ADMIN_STATE_INTERVAL_MS) return;
    this.lastBroadcastAt = now;
    for (const [socket, connection] of this.connections) {
      if (!adminSubscriptionIsActive(this.sessions, socket, connection)) {
        this.connections.delete(socket);
        continue;
      }
      sendObserverState({ socket, connection, controller, diagnostics });
    }
  }
}

function adminSubscriptionIsActive(
  sessions: AdminSessionRegistry,
  socket: WebSocket,
  connection: ConnState,
): boolean {
  const session = connection.adminSession;
  return socket.readyState === socket.OPEN && session !== null &&
    sessions.isActive({ session, peerAddress: connection.peerAddress });
}

interface SendObserverStateInput {
  readonly socket: WebSocket;
  readonly connection: ConnState;
  readonly controller: AdminController;
  readonly diagnostics: ServerNetworkDiagnostics | undefined;
}

function sendObserverState(input: SendObserverStateInput): void {
  const { socket, connection, controller, diagnostics } = input;
  const message = controller.observerState(connection.spectator);
  sendServerMessage({
    socket,
    playerId: connection.playerId,
    message: message as AdminServerMessage,
    diagnostics,
  });
}

type AdminServerMessage = Extract<ServerMessage, { type: "adminObserverState" }>;
