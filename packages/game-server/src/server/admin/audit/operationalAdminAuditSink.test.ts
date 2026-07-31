import { describe, expect, it } from "vitest";
import { OperationalAdminAuditSink } from "./operationalAdminAuditSink.js";
import type { OperationalEvent, OperationalEventSink } from "../../operations/operationalEvent.js";

describe("OperationalAdminAuditSink", () => {
  it("keeps bounded target ids but never persists an admin session secret", () => {
    const events = new RecordingOperationalEvents();
    const sink = new OperationalAdminAuditSink(events);

    sink.record({
      at: 1,
      sessionId: "admin-session-secret",
      command: "heal",
      targetIds: ["player-1", "player-2"],
      ok: true,
    });

    expect(events.records).toEqual([expect.objectContaining({
      category: "admin",
      action: "heal",
      actorId: expect.not.stringContaining("admin-session-secret"),
      attributes: expect.objectContaining({ targets: "player-1,player-2" }),
    })]);
  });
});

class RecordingOperationalEvents implements OperationalEventSink {
  readonly records: OperationalEvent[] = [];

  record(event: OperationalEvent): void {
    this.records.push(event);
  }

  async flush(): Promise<void> {}
}
