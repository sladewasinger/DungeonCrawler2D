/** Verifies deterministic wire-rate, codec, queue, and correction aggregation. */
import { describe, expect, it } from "vitest";
import { WireMetrics } from "./metrics.js";

describe("WireMetrics", () => {
  it("reports directional rates and correction bounds from an injected clock", () => {
    const metrics = new WireMetrics();
    metrics.record({ direction: "outbound", bytes: 100, codecMilliseconds: 0.2, queueBytes: 8, nowMs: 1000 });
    metrics.record({ direction: "outbound", bytes: 100, codecMilliseconds: 0.3, queueBytes: 16, nowMs: 2000 });
    metrics.record({ direction: "inbound", bytes: 400, codecMilliseconds: 0.5, queueBytes: 4, nowMs: 2000 });
    metrics.recordRoundTrip(50);
    metrics.recordRoundTrip(70);
    metrics.recordRoundTrip(60);
    metrics.recordRecoveryRequest();
    metrics.recordCorrection(0.1);
    metrics.recordCorrection(0.3);

    expect(metrics.snapshot(3000)).toEqual({
      inboundMessagesPerSecond: 0.5,
      outboundMessagesPerSecond: 1,
      inboundBytesPerSecond: 200,
      outboundBytesPerSecond: 100,
      encodeMilliseconds: 0.5,
      decodeMilliseconds: 0.5,
      maximumQueueBytes: 16,
      roundTripMilliseconds: 60,
      roundTripJitterMilliseconds: 15,
      recoveryRequests: 1,
      meanCorrectionError: 0.2,
      maximumCorrectionError: 0.3,
    });
  });
});
