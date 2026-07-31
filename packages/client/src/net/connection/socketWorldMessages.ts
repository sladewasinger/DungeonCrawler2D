import {
  type ServerMessage,
} from "@dc2d/engine";
import { queueCorpNetSnapshot } from "../corpnet/index.js";
import { applySnapshot } from "../sync/apply.js";
import type { Connection } from "./connection.js";
import { applySnapshotDelta } from "../snapshots/snapshotDelta.js";
import { applyWelcome } from "./welcome.js";

export interface WorldMessageHandling {
  readonly conn: Connection;
  readonly msg: ServerMessage;
  readonly onProtocolMismatch: TerminalConnectionHandler;
  readonly onIdleTimeout: TerminalConnectionHandler;
}

type TerminalConnectionHandler = (conn: Connection, message: string) => void;

export function handleWorldMessage(input: WorldMessageHandling): void {
  const { conn, msg } = input;
  switch (msg.type) {
    case "welcome":
      applyWelcome(conn, msg);
      return;
    case "snapshot":
    case "snapshotDelta":
      applyIncomingSnapshot(conn, msg);
      return;
    case "pong":
      recordRoundTrip(conn, msg.t);
      return;
    case "error":
      handleServerError(input);
      return;
  }
}

function applyIncomingSnapshot(
  conn: Connection,
  msg: Extract<ServerMessage, { type: "snapshot" | "snapshotDelta" }>,
): void {
  if (conn.corpNet.enabled) {
    queueCorpNetSnapshot(conn, msg, performance.now());
    return;
  }
  applyImmediateSnapshot(conn, msg);
}

function recordRoundTrip(conn: Connection, sentAt: number): void {
  const roundTrip = performance.now() - sentAt;
  conn.rttMs = roundTrip;
  conn.networkMetrics.recordRoundTrip(roundTrip);
}

function handleServerError({ conn, msg, onProtocolMismatch, onIdleTimeout }: WorldMessageHandling): void {
  if (msg.type !== "error") return;
  console.error(`[server] ${msg.code}: ${msg.message}`);
  if (msg.code === "protocol_mismatch") onProtocolMismatch(conn, msg.message);
  if (msg.code === "idle_timeout") onIdleTimeout(conn, msg.message);
}

function applyImmediateSnapshot(
  conn: Connection,
  msg: Extract<ServerMessage, { type: "snapshot" | "snapshotDelta" }>,
): void {
  if (msg.type === "snapshot") {
    conn.snapshotRevisions.reset();
    applySnapshot(conn, msg);
    return;
  }
  applySnapshotDelta(conn, msg);
}
