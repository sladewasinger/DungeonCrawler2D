import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { FloorRegistry } from "../../floors/floorRegistry.js";
import type { GameSim } from "../../sim/core/index.js";
import type { AdminController } from "../admin/controller.js";
import { normalizedPeerAddress } from "../admin/access/peerAddress.js";
import { AdminAccessLimiter } from "../admin/access/rateLimit.js";
import type { AdminSessionRegistry } from "../admin/access/sessionRegistry.js";
import { newSpectatorSession } from "../admin/spectator/spectatorSession.js";
import type { AdminStateSubscriptions } from "../admin/observer/adminStateSubscriptions.js";
import type { ServerNetworkDiagnostics } from "../telemetry/networkDiagnostics.js";
import type { ConnState, SocketMap } from "../types.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";
import { peerFingerprint } from "../operations/operationalEventIdentity.js";
import type { SpectatorSubscriptions } from "../spectator/spectatorSubscriptions.js";

export interface ServerConnectionContext {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim;
  readonly sockets: SocketMap;
  readonly seedInputText?: string;
  readonly worldSeed: number;
  readonly diagnostics: ServerNetworkDiagnostics;
  readonly operationalEvents?: OperationalEventSink;
  /** Deployment secret used only for one-way peer correlation. */
  readonly operationalEventPepper?: string;
  readonly admin?: AdminController;
  readonly adminToken?: string | null;
  readonly adminAccess?: AdminAccessLimiter;
  readonly adminSessions: AdminSessionRegistry;
  readonly adminSubscriptions?: AdminStateSubscriptions;
  readonly spectatorSubscriptions?: SpectatorSubscriptions;
  readonly trustProxy?: boolean;
}

export interface ServerConnectionMessageContext extends ServerConnectionContext {
  readonly ws: WebSocket;
  readonly conn: ConnState;
  readonly adminAccess: AdminAccessLimiter;
  readonly trustProxy: boolean;
}

export function createServerConnectionMessageContext(
  ws: WebSocket,
  context: ServerConnectionContext,
  request?: IncomingMessage,
): ServerConnectionMessageContext {
  const adminAccess = context.adminAccess ?? new AdminAccessLimiter();
  const trustProxy = context.trustProxy ?? false;
  const conn = createConnectionState(context, request, trustProxy);
  return { ...context, ws, conn, adminAccess, trustProxy };
}

function createConnectionState(
  context: ServerConnectionContext,
  request: IncomingMessage | undefined,
  trustProxy: boolean,
): ConnState {
  const peerAddress = normalizedPeerAddress({
    socketAddress: request?.socket.remoteAddress,
    forwardedFor: request?.headers["x-forwarded-for"],
    trustProxy,
  });
  return {
    playerId: null,
    lastMeaningfulActivityAt: null,
    lastAim: null,
    idleTimedOut: false,
    terminationReason: null,
    peerFingerprint: peerFingerprint(peerAddress, context.operationalEventPepper),
    adminSession: null,
    peerAddress,
    spectator: context.admin?.createSpectator() ?? newSpectatorSession(),
  };
}
