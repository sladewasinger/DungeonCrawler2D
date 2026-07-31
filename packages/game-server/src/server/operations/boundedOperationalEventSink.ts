import type { OperationalEvent, OperationalEventSink } from "./operationalEvent.js";

export interface OperationalEventWriter {
  write(event: OperationalEvent): Promise<void>;
}

export interface OperationalEventLogger {
  error(event: OperationalEventWriteFailure): void;
  warn(event: OperationalEventDropNotice): void;
}

export interface OperationalEventWriteFailure {
  readonly eventType: "operational_event_write_failed";
  readonly category: OperationalEvent["category"];
  readonly action: string;
  readonly errorName: string;
}

export interface OperationalEventDropNotice {
  readonly eventType: "operational_event_dropped";
  readonly capacity: number;
}

export interface BoundedOperationalEventSinkOptions {
  readonly writer: OperationalEventWriter;
  readonly logger: OperationalEventLogger;
  readonly capacity?: number;
  readonly flushTimeoutMs?: number;
}

const DEFAULT_CAPACITY = 512;
const DEFAULT_FLUSH_TIMEOUT_MS = 1_500;

/**
 * Fire-and-forget persistence with a hard queue cap. Gameplay never waits for
 * DynamoDB, and a transient AWS failure cannot become an unhandled rejection.
 */
export class BoundedOperationalEventSink implements OperationalEventSink {
  private readonly queue: OperationalEvent[] = [];
  private readonly writer: OperationalEventWriter;
  private readonly logger: OperationalEventLogger;
  private readonly capacity: number;
  private readonly flushTimeoutMs: number;
  private drainPromise: Promise<void> | null = null;

  constructor(options: BoundedOperationalEventSinkOptions) {
    this.writer = options.writer;
    this.logger = options.logger;
    this.capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.flushTimeoutMs = options.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
  }

  record(event: OperationalEvent): void {
    this.enqueue(event);
    void this.drain();
  }

  async flush(): Promise<void> {
    const completion = this.drain();
    await Promise.race([completion, timeout(this.flushTimeoutMs)]);
  }

  private enqueue(event: OperationalEvent): void {
    if (this.queue.length >= this.capacity) {
      this.queue.shift();
      this.logger.warn({ eventType: "operational_event_dropped", capacity: this.capacity });
    }
    this.queue.push(event);
  }

  private drain(): Promise<void> {
    this.drainPromise ??= this.writeQueuedEvents().finally(() => {
      this.drainPromise = null;
    });
    return this.drainPromise;
  }

  private async writeQueuedEvents(): Promise<void> {
    let event = this.queue.shift();
    while (event) {
      await this.writeEvent(event);
      event = this.queue.shift();
    }
  }

  private async writeEvent(event: OperationalEvent): Promise<void> {
    try {
      await this.writer.write(event);
    } catch (error) {
      this.logger.error({
        eventType: "operational_event_write_failed",
        category: event.category,
        action: event.action,
        errorName: errorName(error),
      });
    }
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

function timeout(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
