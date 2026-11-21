export interface ServerRuntimeWorkMetric {
  readonly count: number;
  readonly totalMs: number;
  readonly maxMs: number;
  readonly lastMs: number;
}

const metrics = new Map<string, ServerRuntimeWorkMetric>();

export function measureServerWork<T>(name: string, work: () => T): T {
  const started = performance.now();
  try {
    return work();
  } finally {
    const previous = metrics.get(name);
    const durationMs = performance.now() - started;
    metrics.set(name, {
      count: (previous?.count ?? 0) + 1,
      totalMs: (previous?.totalMs ?? 0) + durationMs,
      maxMs: Math.max(previous?.maxMs ?? 0, durationMs),
      lastMs: durationMs,
    });
  }
}

export async function measureServerAsyncWork<T>(
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await work();
  } finally {
    const previous = metrics.get(name);
    const durationMs = performance.now() - started;
    metrics.set(name, {
      count: (previous?.count ?? 0) + 1,
      totalMs: (previous?.totalMs ?? 0) + durationMs,
      maxMs: Math.max(previous?.maxMs ?? 0, durationMs),
      lastMs: durationMs,
    });
  }
}

export function serverRuntimeWorkSnapshot(): Readonly<Record<string, ServerRuntimeWorkMetric>> {
  return Object.fromEntries(
    [...metrics.entries()].map(([name, metric]) => [name, { ...metric }]),
  );
}
