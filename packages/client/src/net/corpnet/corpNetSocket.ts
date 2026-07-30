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
  scheduleCorpNetWatchdog(conn);
}

export function stopCorpNetWatchdog(conn: Connection): void {
  if (conn.corpNetWatchdogTimer) clearTimeout(conn.corpNetWatchdogTimer);
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
  scheduleCorpNetWatchdog(conn);
}

function scheduleCorpNetSnapshotFlush(conn: Connection): void {
  if (conn.corpNetFlushTimer) return;
  conn.corpNetFlushTimer = setTimeout(() => {
    conn.corpNetFlushTimer = null;
    flushCorpNetSnapshots(conn);
  }, EXPERIMENTAL_CORPNET_TUNING.snapshots.flushDelayMs);
}

function checkCorpNetStall(conn: Connection): void {
  if (conn.ws?.readyState !== WebSocket.OPEN) {
    scheduleCorpNetWatchdog(conn, EXPERIMENTAL_CORPNET_TUNING.stall.watchdogRetryDelayMs);
    return;
  }
  const watchdog = conn.corpNet.watchdog(performance.now());
  if (watchdog.requestRecovery) {
    requestSnapshotBaseline(conn, { retryPending: true });
  }
  scheduleCorpNetWatchdog(conn);
}

function scheduleCorpNetWatchdog(conn: Connection, minimumDelayMs = 0): void {
  if (!conn.corpNet.enabled || conn.status !== "connected") return;
  if (conn.corpNetWatchdogTimer) clearTimeout(conn.corpNetWatchdogTimer);
  const nowMs = performance.now();
  const deadlineMs = conn.corpNet.watchdogDeadlineMs();
  if (deadlineMs === null) {
    conn.corpNetWatchdogTimer = null;
    return;
  }
  const delayMs = Math.max(minimumDelayMs, deadlineMs - nowMs);
  conn.corpNetWatchdogTimer = setTimeout(() => {
    conn.corpNetWatchdogTimer = null;
    checkCorpNetStall(conn);
  }, delayMs);
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
