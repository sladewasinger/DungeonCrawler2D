/** Opt-in main-thread work counters for reproducing runtime stalls locally. */
export interface RuntimeWorkMetric {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

export type RuntimeWorkSnapshot = Readonly<Record<string, RuntimeWorkMetric>>;

interface RuntimeWorkSink {
  readonly record: (name: string, durationMs: number) => void;
  readonly snapshot: () => RuntimeWorkSnapshot;
}

declare global {
  interface Window {
    __dc2dRuntimeWork?: RuntimeWorkSink;
  }
}

export const runtimeWorkTracingEnabled = typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("runtimeTrace") === "1";
const metrics = new Map<string, RuntimeWorkMetric>();

if (runtimeWorkTracingEnabled) {
  window.__dc2dRuntimeWork = {
    record: recordRuntimeWork,
    snapshot: snapshotRuntimeWork,
  };
}

export function measureRuntimeWork<T>(name: string, work: () => T): T {
  if (!runtimeWorkTracingEnabled) return work();
  const started = performance.now();
  try {
    return work();
  } finally {
    recordRuntimeWorkSample(name, performance.now() - started);
  }
}

export function recordRuntimeWork(name: string, durationMs: number): void {
  recordRuntimeWorkSample(name, durationMs);
}

function recordRuntimeWorkSample(name: string, durationMs: number): void {
  if (!runtimeWorkTracingEnabled) return;
  const previous = metrics.get(name);
  metrics.set(name, {
    count: (previous?.count ?? 0) + 1,
    totalMs: (previous?.totalMs ?? 0) + durationMs,
    maxMs: Math.max(previous?.maxMs ?? 0, durationMs),
    lastMs: durationMs,
  });
}

function snapshotRuntimeWork(): RuntimeWorkSnapshot {
  return Object.fromEntries(
    [...metrics.entries()].map(([name, metric]) => [name, { ...metric }]),
  );
}
