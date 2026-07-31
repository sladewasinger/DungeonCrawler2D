import type { ConnState } from "../types.js";
import type { OperationalEventSink } from "../operations/operationalEvent.js";

export interface ConnectionCloseEventInput {
  readonly events: OperationalEventSink | undefined;
  readonly conn: ConnState;
  readonly code: number;
}

export function recordConnectionOpened(
  events: OperationalEventSink | undefined,
  conn: ConnState,
): void {
  events?.record({
    at: Date.now(),
    category: "connection",
    action: "opened",
    ...(conn.peerFingerprint ? { actorId: conn.peerFingerprint } : {}),
  });
}

export function recordConnectionJoined(input: {
  readonly events: OperationalEventSink | undefined;
  readonly conn: ConnState;
  readonly playerId: string;
  readonly level: string;
  readonly resumed: boolean;
}): void {
  input.events?.record({
    at: Date.now(),
    category: "connection",
    action: "joined",
    actorId: input.playerId,
    attributes: joinedAttributes(input),
  });
}

export function recordConnectionClosed(input: ConnectionCloseEventInput): void {
  const { events, conn, code } = input;
  const actorId = connectionActor(conn);
  events?.record({
    at: Date.now(),
    category: "connection",
    action: "closed",
    ...(actorId ? { actorId } : {}),
    attributes: {
      reason: connectionCloseReason(conn, code),
      hadJoined: conn.playerId !== null,
    },
  });
}

function joinedAttributes(input: {
  readonly conn: ConnState;
  readonly level: string;
  readonly resumed: boolean;
}): Record<string, string | boolean> {
  return {
    level: input.level,
    resumed: input.resumed,
    ...(input.conn.peerFingerprint ? { peerFingerprint: input.conn.peerFingerprint } : {}),
  };
}

function connectionActor(conn: ConnState): string | null {
  return conn.playerId ?? conn.peerFingerprint;
}

function connectionCloseReason(conn: ConnState, code: number): string {
  if (conn.terminationReason) return conn.terminationReason;
  if (code === 1002) return "protocol_error";
  if (code === 1008) return "policy_rejected";
  if (code === 1001) return "server_stopping";
  if (code === 1006) return "transport_lost";
  return "client_closed";
}
