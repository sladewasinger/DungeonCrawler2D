export interface AdminAuditRecord {
  readonly at: number;
  readonly sessionId: string;
  /** Present only for a live gameplay operator; never client-supplied authority. */
  readonly operatorPlayerId?: string;
  readonly command: string;
  readonly targetIds: readonly string[];
  readonly ok: boolean;
  readonly code?: string;
}

export interface AdminAuditSink {
  record(event: AdminAuditRecord): void;
}

export interface AdminAuditHistory {
  recent(limit: number): readonly AdminAuditRecord[];
}

/** Bounded local sink. Production can inject a durable compliance adapter. */
export class MemoryAdminAuditSink implements AdminAuditSink, AdminAuditHistory {
  private readonly records: AdminAuditRecord[] = [];

  constructor(private readonly capacity = 256) {}

  record(event: AdminAuditRecord): void {
    this.records.push(event);
    while (this.records.length > this.capacity) this.records.shift();
  }

  snapshot(): readonly AdminAuditRecord[] {
    return this.records.slice();
  }

  recent(limit: number): readonly AdminAuditRecord[] {
    const requested = Number.isFinite(limit) ? Math.floor(limit) : 0;
    const count = Math.max(0, Math.min(this.capacity, requested));
    return this.records.slice(-count);
  }
}
