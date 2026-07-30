import { afterEach, describe, expect, it, vi } from "vitest";
import { freshConnection } from "../sync/applyTestSupport.js";
import {
  flushCorpNetSnapshots,
  queueCorpNetSnapshot,
  stopCorpNetWatchdog,
  startCorpNetWatchdog,
} from "./corpNetSocket.js";
import { EXPERIMENTAL_CORPNET_TUNING } from "./corpNetTuning.js";
import { invalidDelta, validDelta } from "./corpNetSocketTestSupport.js";

describe("CorpNet snapshot recovery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("schedules recovery at the deadline and preserves exponential backoff", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const connection = freshConnection(1);
    connection.status = "connected";
    connection.ws = { readyState: WebSocket.OPEN } as WebSocket;
    connection.corpNet.setEnabled(true, 0);
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);
    const recoveryAfter = EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;
    const initialBackoff = EXPERIMENTAL_CORPNET_TUNING.stall.initialRecoveryBackoffMs;

    startCorpNetWatchdog(connection);
    vi.advanceTimersByTime(recoveryAfter - 1);
    expect(send).not.toHaveBeenCalled();

    now.mockReturnValue(recoveryAfter);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);

    now.mockReturnValue(recoveryAfter + initialBackoff - 1);
    vi.advanceTimersByTime(initialBackoff - 1);
    expect(send).toHaveBeenCalledTimes(1);

    now.mockReturnValue(recoveryAfter + initialBackoff);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(2);
    stopCorpNetWatchdog(connection);
  });

  it("reschedules the absolute deadline after a queued snapshot is observed", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const connection = freshConnection(1);
    connection.status = "connected";
    connection.ws = { readyState: WebSocket.OPEN } as WebSocket;
    connection.corpNet.setEnabled(true, 0);
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);
    const recoveryAfter = EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;

    startCorpNetWatchdog(connection);
    now.mockReturnValue(1_000);
    vi.advanceTimersByTime(1_000);
    queueCorpNetSnapshot(connection, validDelta({
      tick: 1,
      baseTick: null,
      baseline: true,
    }), 1_000);

    now.mockReturnValue(2_500);
    vi.advanceTimersByTime(1_500);
    expect(send).not.toHaveBeenCalled();

    now.mockReturnValue(3_499);
    vi.advanceTimersByTime(recoveryAfter - 1_500 - 1);
    expect(send).not.toHaveBeenCalled();

    now.mockReturnValue(3_500);
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    stopCorpNetWatchdog(connection);
  });

  it("keeps a connected watchdog scheduled while the socket is temporarily non-open", () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const connection = freshConnection(1);
    const socket = { readyState: 0 };
    connection.status = "connected";
    connection.ws = socket as WebSocket;
    connection.corpNet.setEnabled(true, 0);
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);
    const recoveryAfter = EXPERIMENTAL_CORPNET_TUNING.stall.recoveryAfterMs;
    const retryDelay = EXPERIMENTAL_CORPNET_TUNING.stall.watchdogRetryDelayMs;

    startCorpNetWatchdog(connection);
    now.mockReturnValue(recoveryAfter);
    vi.advanceTimersByTime(recoveryAfter);
    expect(send).not.toHaveBeenCalled();

    socket.readyState = WebSocket.OPEN;
    now.mockReturnValue(recoveryAfter + retryDelay);
    vi.advanceTimersByTime(retryDelay);
    expect(send).toHaveBeenCalledTimes(1);
    stopCorpNetWatchdog(connection);
  });

  it("applies event snapshots immediately after queued dynamic deltas", () => {
    const connection = freshConnection(1);
    connection.corpNet.setEnabled(true, 0);

    queueCorpNetSnapshot(connection, validDelta({
      tick: 1,
      baseTick: null,
      baseline: true,
    }), 100);
    queueCorpNetSnapshot(connection, validDelta({
      tick: 2,
      baseTick: 1,
      baseline: false,
    }), 110);
    queueCorpNetSnapshot(connection, validDelta({
      tick: 3,
      baseTick: 2,
      baseline: false,
      events: [{ t: "toast", msg: "Recovered" }],
    }), 120);
    stopCorpNetWatchdog(connection);

    expect(connection.serverTick).toBe(3);
    expect(connection.toasts).toEqual([{ msg: "Recovered", until: expect.any(Number) }]);
  });

  it("keeps retrying when packets arrive but none can be applied", () => {
    const connection = freshConnection(1);
    connection.corpNet.setEnabled(true, 0);
    const observed = vi.spyOn(connection.corpNet, "observeSnapshot");
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);

    queueCorpNetSnapshot(connection, invalidDelta(), 100);
    flushCorpNetSnapshots(connection);
    stopCorpNetWatchdog(connection);

    expect(connection.snapshotRevisions.awaitingBaseline).toBe(true);
    expect(send).toHaveBeenCalledWith({ type: "snapshotResync" });
    expect(observed).not.toHaveBeenCalled();
  });
});
