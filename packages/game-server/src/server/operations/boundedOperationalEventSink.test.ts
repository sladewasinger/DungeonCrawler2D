import { describe, expect, it } from "vitest";
import {
  BoundedOperationalEventSink,
  type OperationalEventLogger,
  type OperationalEventWriter,
} from "./boundedOperationalEventSink.js";
import type { OperationalEvent } from "./operationalEvent.js";

describe("BoundedOperationalEventSink", () => {
  it("records write failures without rejecting gameplay callers", async () => {
    const logger = new RecordingLogger();
    const sink = new BoundedOperationalEventSink({
      writer: new RejectingWriter(),
      logger,
    });

    sink.record(connectionEvent());
    await sink.flush();

    expect(logger.errors).toEqual([{
      eventType: "operational_event_write_failed",
      category: "connection",
      action: "joined",
      errorName: "Error",
    }]);
  });

  it("drops the oldest queued record when its bounded buffer is full", async () => {
    const writer = new DeferredWriter();
    const logger = new RecordingLogger();
    const sink = new BoundedOperationalEventSink({ writer, logger, capacity: 2 });

    sink.record(connectionEvent("opened"));
    sink.record(connectionEvent("joined"));
    sink.record(connectionEvent("security"));
    sink.record(connectionEvent("closed"));
    writer.release();
    await sink.flush();

    expect(writer.actions).toEqual(["opened", "security", "closed"]);
    expect(logger.warnings).toEqual([{ eventType: "operational_event_dropped", capacity: 2 }]);
  });
});

function connectionEvent(action = "joined"): OperationalEvent {
  return { at: 1, category: "connection", action };
}

class RejectingWriter implements OperationalEventWriter {
  async write(): Promise<void> {
    throw new Error("DynamoDB unavailable");
  }
}

class DeferredWriter implements OperationalEventWriter {
  readonly actions: string[] = [];
  private releaseWrite: (() => void) | null = null;
  private firstWrite = true;

  async write(event: OperationalEvent): Promise<void> {
    this.actions.push(event.action);
    if (!this.firstWrite) return;
    this.firstWrite = false;
    await new Promise<void>((resolve) => {
      this.releaseWrite = resolve;
    });
  }

  release(): void {
    this.releaseWrite?.();
  }
}

class RecordingLogger implements OperationalEventLogger {
  readonly errors: Parameters<OperationalEventLogger["error"]>[0][] = [];
  readonly warnings: Parameters<OperationalEventLogger["warn"]>[0][] = [];

  error(event: Parameters<OperationalEventLogger["error"]>[0]): void {
    this.errors.push(event);
  }

  warn(event: Parameters<OperationalEventLogger["warn"]>[0]): void {
    this.warnings.push(event);
  }
}
