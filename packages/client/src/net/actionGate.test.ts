import { describe, expect, it } from "vitest";
import { IDLE_GATE, resolvePendingGate } from "./actionGate.js";

describe("actionGate", () => {
  it("accepts server state immediately when idle", () => {
    expect(resolvePendingGate(IDLE_GATE, { serverAck: 0, nowMs: 100 })).toEqual({ nextGate: IDLE_GATE, accept: true });
  });

  it("ignores stale pre-ack server snapshots until caught up or timed out", () => {
    const armed = { pendingSeq: 5, atMs: 1000 };
    expect(resolvePendingGate(armed, { serverAck: 4, nowMs: 1200 })).toEqual({ nextGate: armed, accept: false });
    expect(resolvePendingGate(armed, { serverAck: 5, nowMs: 1250 })).toEqual({ nextGate: IDLE_GATE, accept: true });
    expect(resolvePendingGate(armed, { serverAck: 4, nowMs: 2500 })).toEqual({ nextGate: IDLE_GATE, accept: true });
  });
});
