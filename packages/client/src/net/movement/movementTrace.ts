import { type ClientInput } from "@dc2d/engine";
import { BUILD_SHA } from "../../buildInfo.js";
import {
  frameTraceRecord,
  inputTraceRecord,
  snapshotTraceRecord,
  type FrameTraceInput,
  type MovementTraceFile,
  type MovementTraceMetadata,
  type MovementTraceRecord,
  type MovementTraceRecordData,
  type SnapshotTraceInput,
} from "./movementTraceFormat.js";

export type {
  FrameTraceInput,
  MovementTraceClientState,
  MovementTraceFile,
  MovementTraceMetadata,
  SnapshotTraceInput,
  TracePosition,
} from "./movementTraceFormat.js";

export const MOVEMENT_TRACE_MAX_MS = 60_000;
const MOVEMENT_TRACE_MAX_RECORDS = 12_000;

interface ActiveTrace {
  startedAt: number;
  startedAtIso: string;
  metadata: MovementTraceMetadata;
  records: MovementTraceRecord[];
  truncated: boolean;
}

export class MovementTraceRecorder {
  private active: ActiveTrace | null = null;

  start(metadata: MovementTraceMetadata, now = performance.now()): boolean {
    if (this.active) return false;
    this.active = { startedAt: now, startedAtIso: new Date().toISOString(), metadata, records: [], truncated: false };
    return true;
  }

  stop(reason: MovementTraceFile["stopReason"] = "manual", now = performance.now()): MovementTraceFile | null {
    const active = this.active;
    if (!active) return null;
    this.active = null;
    return {
      format: "dc2d-movement-trace", version: 1, build: BUILD_SHA, startedAt: active.startedAtIso,
      durationMs: Math.max(0, now - active.startedAt), stopReason: reason,
      metadata: { ...active.metadata, userAgent: navigator.userAgent }, records: active.records, truncated: active.truncated,
    };
  }

  cancel(): void { this.active = null; }

  recordInput(input: ClientInput, state: import("./movementTraceFormat.js").MovementTraceClientState): void {
    this.append(inputTraceRecord(input, state));
  }

  recordSnapshot(input: SnapshotTraceInput): void { this.append(snapshotTraceRecord(input)); }

  recordFrame(input: FrameTraceInput): void { this.append(frameTraceRecord(input)); }

  get recording(): boolean { return this.active !== null; }

  elapsedMs(now = performance.now()): number {
    return this.active ? Math.max(0, now - this.active.startedAt) : 0;
  }

  timedOut(now = performance.now()): boolean { return this.elapsedMs(now) >= MOVEMENT_TRACE_MAX_MS; }

  private append(record: MovementTraceRecordData): void {
    const active = this.active;
    if (!active) return;
    if (active.records.length >= MOVEMENT_TRACE_MAX_RECORDS) {
      active.truncated = true;
      return;
    }
    active.records.push({ atMs: Math.max(0, performance.now() - active.startedAt), ...record });
  }
}
