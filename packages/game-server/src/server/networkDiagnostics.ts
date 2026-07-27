/** Owns aggregate and per-client WebSocket traffic metrics for the running server. */
import { WireMetrics, type WireMetricSnapshot, type WireDirection } from "@dc2d/engine";
import { Buffer } from "node:buffer";

const HANDSHAKE_CLIENT = "handshake";

export interface NetworkMetricRecord {
  playerId: string | null;
  direction: WireDirection;
  payload: string;
  codecMilliseconds: number;
  queueBytes: number;
  nowMs: number;
}

export class ServerNetworkDiagnostics {
  private readonly aggregate = new WireMetrics();
  private readonly clients = new Map<string, WireMetrics>();

  record(record: NetworkMetricRecord): void {
    const { playerId, direction, payload, codecMilliseconds, queueBytes, nowMs } = record;
    const bytes = Buffer.byteLength(payload, "utf8");
    this.aggregate.record({ direction, bytes, codecMilliseconds, queueBytes, nowMs });
    this.client(playerId).record({ direction, bytes, codecMilliseconds, queueBytes, nowMs });
  }

  snapshot(nowMs: number): {
    server: WireMetricSnapshot;
    clients: ReadonlyMap<string, WireMetricSnapshot>;
  } {
    return {
      server: this.aggregate.snapshot(nowMs),
      clients: new Map(
        [...this.clients].map(([id, metrics]) => [id, metrics.snapshot(nowMs)]),
      ),
    };
  }

  removeClient(playerId: string): void {
    this.clients.delete(playerId);
  }

  private client(playerId: string | null): WireMetrics {
    const id = playerId ?? HANDSHAKE_CLIENT;
    let metrics = this.clients.get(id);
    if (!metrics) {
      metrics = new WireMetrics();
      this.clients.set(id, metrics);
    }
    return metrics;
  }
}
