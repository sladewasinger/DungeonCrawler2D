import {
  type BodyState,
  type ClientInput,
  type MoveInput,
  type ServerSnapshot,
} from "@dc2d/engine";
import { BUILD_SHA } from "../buildInfo.js";

export const MOVEMENT_TRACE_MAX_MS = 60_000;
const MOVEMENT_TRACE_MAX_RECORDS = 12_000;

interface TracePosition {
  x: number;
  y: number;
  z: number;
}

export interface MovementTraceClientState {
  status: "connecting" | "connected" | "closed";
  serverTick: number;
  rttMs: number;
  projectedTick: number | null;
  pendingSteps: number;
  correctionError: number;
  body: BodyState | null;
}

interface MovementTraceMetadata {
  endpoint: string;
  worldSeed: number | null;
  floor: number;
}

interface MovementTraceRecord {
  atMs: number;
  kind: "input" | "snapshot" | "frame";
  [key: string]: unknown;
}

export interface MovementTraceFile {
  format: "dc2d-movement-trace";
  version: 1;
  build: string;
  startedAt: string;
  durationMs: number;
  stopReason: "manual" | "timeout";
  metadata: MovementTraceMetadata & {
    userAgent: string;
  };
  records: MovementTraceRecord[];
  truncated: boolean;
}

interface ActiveTrace {
  startedAt: number;
  startedAtIso: string;
  metadata: MovementTraceMetadata;
  records: MovementTraceRecord[];
  truncated: boolean;
}

function position(body: Pick<BodyState, "x" | "y" | "z"> | null): TracePosition | null {
  return body ? { x: body.x, y: body.y, z: body.z } : null;
}

function clientState(state: MovementTraceClientState): Record<string, unknown> {
  return {
    status: state.status,
    serverTick: state.serverTick,
    rttMs: state.rttMs,
    projectedTick: state.projectedTick,
    pendingSteps: state.pendingSteps,
    correctionError: state.correctionError,
    body: position(state.body),
  };
}

export class MovementTraceRecorder {
  private active: ActiveTrace | null = null;

  start(metadata: MovementTraceMetadata, now = performance.now()): boolean {
    if (this.active) return false;
    this.active = {
      startedAt: now,
      startedAtIso: new Date().toISOString(),
      metadata,
      records: [],
      truncated: false,
    };
    return true;
  }

  stop(
    reason: MovementTraceFile["stopReason"] = "manual",
    now = performance.now(),
  ): MovementTraceFile | null {
    const active = this.active;
    if (!active) return null;
    this.active = null;
    return {
      format: "dc2d-movement-trace",
      version: 1,
      build: BUILD_SHA,
      startedAt: active.startedAtIso,
      durationMs: Math.max(0, now - active.startedAt),
      stopReason: reason,
      metadata: {
        ...active.metadata,
        userAgent: navigator.userAgent,
      },
      records: active.records,
      truncated: active.truncated,
    };
  }

  cancel(): void {
    this.active = null;
  }

  recordInput(input: ClientInput, state: MovementTraceClientState): void {
    this.append({
      kind: "input",
      input: {
        seq: input.seq,
        projectedServerTick: input.projectedServerTick,
        moveX: input.moveX,
        moveY: input.moveY,
        faceX: input.faceX ?? null,
        faceY: input.faceY ?? null,
        jump: input.jump,
        run: input.run,
        block: input.block ?? false,
      },
      client: clientState(state),
    });
  }

  recordSnapshot(
    snapshot: ServerSnapshot,
    predictedBefore: BodyState | null,
    predictedAfter: BodyState | null,
    state: MovementTraceClientState,
  ): void {
    this.append({
      kind: "snapshot",
      snapshot: {
        tick: snapshot.tick,
        lastSeq: snapshot.lastSeq,
        lastProjectedServerTick: snapshot.lastProjectedServerTick,
        authoritativeBody: {
          x: snapshot.self.x,
          y: snapshot.self.y,
          z: snapshot.self.z,
        },
        stamina: snapshot.self.stamina ?? null,
        floor: snapshot.self.floor ?? null,
        events: snapshot.events.map((event) => event.t),
      },
      predictedBefore: position(predictedBefore),
      predictedAfter: position(predictedAfter),
      client: clientState(state),
    });
  }

  recordFrame(
    time: number,
    input: MoveInput,
    render: TracePosition,
    state: MovementTraceClientState,
  ): void {
    this.append({
      kind: "frame",
      frameTime: time,
      input: {
        moveX: input.moveX,
        moveY: input.moveY,
        jump: input.jump,
        run: input.run ?? false,
        block: input.block ?? false,
      },
      render: { ...render },
      client: clientState(state),
    });
  }

  get recording(): boolean {
    return this.active !== null;
  }

  elapsedMs(now = performance.now()): number {
    return this.active ? Math.max(0, now - this.active.startedAt) : 0;
  }

  timedOut(now = performance.now()): boolean {
    return this.elapsedMs(now) >= MOVEMENT_TRACE_MAX_MS;
  }

  private append(
    record: { kind: MovementTraceRecord["kind"] } & Record<string, unknown>,
  ): void {
    const active = this.active;
    if (!active) return;
    if (active.records.length >= MOVEMENT_TRACE_MAX_RECORDS) {
      active.truncated = true;
      return;
    }
    active.records.push({
      atMs: Math.max(0, performance.now() - active.startedAt),
      ...record,
    });
  }
}
