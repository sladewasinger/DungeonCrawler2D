import type { ServerSnapshot, ServerSnapshotDelta } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { applySnapshot } from "../sync/apply.js";
import { applySnapshotDelta } from "../snapshots/snapshotDelta.js";
import { requestSnapshotBaseline } from "../snapshots/requestSnapshotBaseline.js";
import { EXPERIMENTAL_CORPNET_TUNING } from "./corpNetTuning.js";

type SnapshotMessage = ServerSnapshot | ServerSnapshotDelta;

export function setExperimentalCorpNetMode(conn: Connection, enabled: boolean): void {
  if (conn.corpNet.enabled === enabled) return;
  if (!enabled) flushCorpNetSnapshots(conn);
  conn.corpNet.setEnabled(enabled, performance.now());
  conn.interpolationDelay.setExperimentalCorpNetEnabled(enabled);
  if (enabled && conn.status === "connected") startCorpNetWatchdog(conn);
  else stopCorpNetWatchdog(conn);
}

export function queueCorpNetSnapshot(
  conn: Connection,
  message: SnapshotMessage,
  receivedAtMs: number,
): void {
  let result = conn.snapshotCoalescer.enqueue({ message, receivedAtMs });
  if (result.flushImmediately) {
    flushCorpNetSnapshots(conn);
    if (!result.queued) {
      result = conn.snapshotCoalescer.enqueue({ message, receivedAtMs });
    }
  }
  if (result.queued && !result.flushImmediately) scheduleCorpNetSnapshotFlush(conn);
}

export function startCorpNetWatchdog(conn: Connection): void {
  if (!conn.corpNet.enabled || conn.corpNetWatchdogTimer) return;
  conn.corpNetWatchdogTimer = setInterval(() => checkCorpNetStall(conn),
    EXPERIMENTAL_CORPNET_TUNING.stall.watchdogIntervalMs);
}

export function stopCorpNetWatchdog(conn: Connection): void {
  if (conn.corpNetWatchdogTimer) clearInterval(conn.corpNetWatchdogTimer);
  conn.corpNetWatchdogTimer = null;
  if (conn.corpNetFlushTimer) clearTimeout(conn.corpNetFlushTimer);
  conn.corpNetFlushTimer = null;
  conn.snapshotCoalescer.reset();
}

export function flushCorpNetSnapshots(conn: Connection): void {
  if (conn.corpNetFlushTimer) clearTimeout(conn.corpNetFlushTimer);
  conn.corpNetFlushTimer = null;
  for (const snapshot of conn.snapshotCoalescer.drain()) {
    applyCorpNetSnapshot(conn, snapshot.message, snapshot.receivedAtMs);
  }
}

function scheduleCorpNetSnapshotFlush(conn: Connection): void {
  if (conn.corpNetFlushTimer) return;
  conn.corpNetFlushTimer = setTimeout(() => {
    conn.corpNetFlushTimer = null;
    flushCorpNetSnapshots(conn);
  }, EXPERIMENTAL_CORPNET_TUNING.snapshots.flushDelayMs);
}

function checkCorpNetStall(conn: Connection): void {
  if (conn.ws?.readyState !== WebSocket.OPEN) return;
  const watchdog = conn.corpNet.watchdog(performance.now());
  if (watchdog.requestRecovery) {
    requestSnapshotBaseline(conn, { retryPending: true });
  }
}

function applyCorpNetSnapshot(
  conn: Connection,
  message: SnapshotMessage,
  receivedAtMs: number,
): void {
  if (message.type === "snapshot") {
    conn.snapshotRevisions.reset();
    applySnapshot(conn, message, receivedAtMs);
    conn.corpNet.observeSnapshot(receivedAtMs);
    return;
  }
  applySnapshotDelta(conn, message, receivedAtMs);
  if (!conn.snapshotRevisions.awaitingBaseline) {
    conn.corpNet.observeSnapshot(receivedAtMs);
  }
}
