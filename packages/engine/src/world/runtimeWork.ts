interface RuntimeWorkSink {
  record(name: string, durationMs: number): void;
}

export function measureWorldWork<T>(name: string, work: () => T): T {
  const sink = runtimeWorkSink();
  if (!sink) return work();
  const started = Date.now();
  try {
    return work();
  } finally {
    sink.record(name, Date.now() - started);
  }
}

function runtimeWorkSink(): RuntimeWorkSink | undefined {
  const candidate = (globalThis as typeof globalThis & {
    __dc2dRuntimeWork?: RuntimeWorkSink;
  }).__dc2dRuntimeWork;
  return candidate && typeof candidate.record === "function" ? candidate : undefined;
}
