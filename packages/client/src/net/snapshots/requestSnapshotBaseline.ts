import type { Connection } from "../connection/connection.js";

export interface SnapshotBaselineRequestOptions {
  readonly retryPending?: boolean;
}

/** Requests one authoritative delta baseline, coalescing duplicate recovery requests. */
export function requestSnapshotBaseline(
  conn: Connection,
  options: SnapshotBaselineRequestOptions = {},
): void {
  conn.snapshotRevisions.awaitingBaseline = true;
  if (conn.snapshotRevisions.resyncPending && !options.retryPending) return;
  conn.snapshotRevisions.resyncPending = true;
  conn.networkMetrics.recordRecoveryRequest();
  conn.send({ type: "snapshotResync" });
}
