export type OperationalEventCategory = "connection" | "admin" | "security" | "server";

export interface OperationalEvent {
  readonly at: number;
  readonly category: OperationalEventCategory;
  readonly action: string;
  /** Server-issued player id, or a one-way identifier for an anonymous peer. */
  readonly actorId?: string;
  /** Small, allow-listed facts only. Never include request or chat text. */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

export interface OperationalEventSink {
  record(event: OperationalEvent): void;
  flush(): Promise<void>;
}

export class NullOperationalEventSink implements OperationalEventSink {
  record(): void {}

  async flush(): Promise<void> {}
}
