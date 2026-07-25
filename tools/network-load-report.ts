import { TICK_RATE } from "@dc2d/engine";
import { cpus } from "node:os";
import type { LoadClientMetrics } from "./network-load-client.js";

export const LOAD_CLIENT_COUNT = 20;
export const LOAD_MEASURED_TICKS = 120;

const percentile = (values: number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.min(index, sorted.length - 1)] ?? 0;
};

const summarizeSteps = (samples: number[]) => ({
  samples: samples.length,
  mean: samples.reduce((sum, value) => sum + value, 0) / samples.length,
  p95: percentile(samples, 0.95),
  p99: percentile(samples, 0.99),
  max: Math.max(...samples),
});

const runtime = () => ({
  node: process.version,
  cpu: cpus()[0]?.model ?? "unknown",
  logicalCpuCount: cpus().length,
});

const transport = (
  metrics: LoadClientMetrics,
  durationSeconds: number,
) => ({
  clientToServerBytesPerSecond: metrics.sentBytes / durationSeconds,
  serverToClientBytesPerSecond: metrics.receivedBytes / durationSeconds,
  maximumClientQueueBytes: metrics.maximumQueueBytes,
  decodeFailures: metrics.decodeFailures,
});

const heap = (memory: { heapStart: number; heapEnd: number }) => ({
  startBytes: memory.heapStart,
  endBytes: memory.heapEnd,
  deltaBytes: memory.heapEnd - memory.heapStart,
});

export const buildNetworkLoadResult = (
  measuredSteps: number[],
  metrics: LoadClientMetrics,
  memory: { heapStart: number; heapEnd: number },
) => {
  const durationSeconds = LOAD_MEASURED_TICKS / TICK_RATE;
  const serverStepMilliseconds = summarizeSteps(measuredSteps);
  const budgets = {
    serverStepP95Milliseconds: 25,
    maximumClientQueueBytes: 65_536,
    decodeFailures: 0,
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    command: "npm run benchmark:network-load",
    clientCount: LOAD_CLIENT_COUNT,
    tickRate: TICK_RATE,
    measuredTicks: LOAD_MEASURED_TICKS,
    measuredDurationSeconds: durationSeconds,
    runtime: runtime(),
    serverStepMilliseconds,
    transport: transport(metrics, durationSeconds),
    heap: heap(memory),
    budgets,
    passed: serverStepMilliseconds.p95 <=
      budgets.serverStepP95Milliseconds &&
      metrics.maximumQueueBytes <= budgets.maximumClientQueueBytes &&
      metrics.decodeFailures === budgets.decodeFailures,
    limitations: [
      "Loopback WebSockets do not model WAN latency or packet loss.",
      "Heap delta includes ordinary runtime allocation and is evidence, not a leak proof.",
      "Clients exercise movement replication but do not render frames.",
    ],
  };
};

export type NetworkLoadResult = ReturnType<typeof buildNetworkLoadResult>;
