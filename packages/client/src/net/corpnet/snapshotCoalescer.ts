import type { ServerSnapshot, ServerSnapshotDelta } from "@dc2d/engine";

export type SnapshotMessage = ServerSnapshot | ServerSnapshotDelta;

export interface QueuedSnapshot {
  readonly message: SnapshotMessage;
  readonly receivedAtMs: number;
}

export interface SnapshotQueueResult {
  readonly queued: boolean;
  readonly flushImmediately: boolean;
}

/**
 * Batches dynamic-only deltas during normal jitter. Critical snapshots retain
 * wire order by flushing the preceding batch and themselves without delay.
 */
export class SnapshotCoalescer {
  private readonly pending: QueuedSnapshot[] = [];
  private readonly maximumQueuedMessages: number;

  constructor(maximumQueuedMessages: number) {
    this.maximumQueuedMessages = Math.max(1, maximumQueuedMessages);
  }

  enqueue(snapshot: QueuedSnapshot): SnapshotQueueResult {
    if (requiresImmediateApplication(snapshot.message)) {
      this.pending.push(snapshot);
      return { queued: true, flushImmediately: true };
    }
    if (this.pending.length >= this.maximumQueuedMessages) {
      return { queued: false, flushImmediately: true };
    }
    this.pending.push(snapshot);
    return { queued: true, flushImmediately: false };
  }

  drain(): QueuedSnapshot[] {
    const snapshots = this.pending.slice();
    this.pending.length = 0;
    return snapshots;
  }

  reset(): void {
    this.pending.length = 0;
  }
}

function requiresImmediateApplication(message: SnapshotMessage): boolean {
  return message.type === "snapshot" ||
    message.baseline ||
    message.baseTick === null ||
    message.events.length > 0 ||
    message.areas.length > 0 ||
    message.left.length > 0;
}
