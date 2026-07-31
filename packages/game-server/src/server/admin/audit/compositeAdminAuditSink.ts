import type { AdminAuditRecord, AdminAuditSink } from "../audit.js";

export class CompositeAdminAuditSink implements AdminAuditSink {
  constructor(private readonly sinks: readonly AdminAuditSink[]) {}

  record(event: AdminAuditRecord): void {
    for (const sink of this.sinks) sink.record(event);
  }
}
