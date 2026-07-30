import { describe, expect, it, vi } from "vitest";
import { freshConnection } from "../sync/applyTestSupport.js";
import { requestSnapshotBaseline } from "./requestSnapshotBaseline.js";

describe("requestSnapshotBaseline", () => {
  it("coalesces ordinary duplicates but permits a watchdog retry", () => {
    const connection = freshConnection(1);
    const send = vi.spyOn(connection, "send").mockImplementation(() => undefined);

    requestSnapshotBaseline(connection);
    requestSnapshotBaseline(connection);
    requestSnapshotBaseline(connection, { retryPending: true });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, { type: "snapshotResync" });
    expect(send).toHaveBeenNthCalledWith(2, { type: "snapshotResync" });
    expect(connection.networkMetrics.snapshot(performance.now()).recoveryRequests).toBe(2);
  });
});
