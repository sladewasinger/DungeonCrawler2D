/** Aggregates wire traffic, codec cost, queue pressure, and correction error without owning a clock. */
export type WireDirection = "inbound" | "outbound";

export interface WireMetricSnapshot {
  readonly inboundMessagesPerSecond: number;
  readonly outboundMessagesPerSecond: number;
  readonly inboundBytesPerSecond: number;
  readonly outboundBytesPerSecond: number;
  readonly encodeMilliseconds: number;
  readonly decodeMilliseconds: number;
  readonly maximumQueueBytes: number;
  readonly roundTripMilliseconds: number;
  readonly roundTripJitterMilliseconds: number;
  readonly recoveryRequests: number;
  readonly meanCorrectionError: number;
  readonly maximumCorrectionError: number;
}

interface DirectionTotals {
  messages: number;
  bytes: number;
  codecMilliseconds: number;
}

function rate(value: number, elapsedSeconds: number): number {
  return elapsedSeconds > 0 ? value / elapsedSeconds : 0;
}

export class WireMetrics {
  private startedAtMs: number | null = null;
  private readonly inbound: DirectionTotals = { messages: 0, bytes: 0, codecMilliseconds: 0 };
  private readonly outbound: DirectionTotals = { messages: 0, bytes: 0, codecMilliseconds: 0 };
  private maximumQueueBytes = 0;
  private roundTripMilliseconds = 0;
  private roundTripJitterTotal = 0;
  private roundTripJitterSamples = 0;
  private recoveryRequests = 0;
  private correctionCount = 0;
  private correctionTotal = 0;
  private maximumCorrectionError = 0;

  record(direction: WireDirection, bytes: number, codecMilliseconds: number, queueBytes: number, nowMs: number): void {
    this.startedAtMs ??= nowMs;
    const totals = direction === "inbound" ? this.inbound : this.outbound;
    totals.messages++;
    totals.bytes += Math.max(0, bytes);
    totals.codecMilliseconds += Math.max(0, codecMilliseconds);
    this.maximumQueueBytes = Math.max(this.maximumQueueBytes, queueBytes);
  }

  recordCorrection(error: number): void {
    if (!Number.isFinite(error) || error < 0) return;
    this.correctionCount++;
    this.correctionTotal += error;
    this.maximumCorrectionError = Math.max(this.maximumCorrectionError, error);
  }

  recordRoundTrip(roundTripMilliseconds: number): void {
    if (!Number.isFinite(roundTripMilliseconds) || roundTripMilliseconds < 0) return;
    if (this.roundTripMilliseconds > 0) {
      this.roundTripJitterTotal += Math.abs(roundTripMilliseconds - this.roundTripMilliseconds);
      this.roundTripJitterSamples++;
    }
    this.roundTripMilliseconds = roundTripMilliseconds;
  }

  recordRecoveryRequest(): void {
    this.recoveryRequests++;
  }

  snapshot(nowMs: number): WireMetricSnapshot {
    const elapsedSeconds = this.startedAtMs === null ? 0 : (nowMs - this.startedAtMs) / 1000;
    return {
      inboundMessagesPerSecond: rate(this.inbound.messages, elapsedSeconds),
      outboundMessagesPerSecond: rate(this.outbound.messages, elapsedSeconds),
      inboundBytesPerSecond: rate(this.inbound.bytes, elapsedSeconds),
      outboundBytesPerSecond: rate(this.outbound.bytes, elapsedSeconds),
      encodeMilliseconds: this.outbound.codecMilliseconds,
      decodeMilliseconds: this.inbound.codecMilliseconds,
      maximumQueueBytes: this.maximumQueueBytes,
      roundTripMilliseconds: this.roundTripMilliseconds,
      roundTripJitterMilliseconds: this.roundTripJitterSamples > 0
        ? this.roundTripJitterTotal / this.roundTripJitterSamples
        : 0,
      recoveryRequests: this.recoveryRequests,
      meanCorrectionError: this.correctionCount > 0 ? this.correctionTotal / this.correctionCount : 0,
      maximumCorrectionError: this.maximumCorrectionError,
    };
  }
}
