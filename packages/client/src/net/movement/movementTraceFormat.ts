import { type BodyState, type ClientInput, type MoveInput, type ServerSnapshot } from "@dc2d/engine";

export interface TracePosition {
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

export interface MovementTraceMetadata {
  endpoint: string;
  seedInputText?: string | null;
  worldSeed: number | null;
  floor: number;
}

export interface MovementTraceRecord {
  atMs: number;
  kind: "input" | "snapshot" | "frame";
  [key: string]: unknown;
}
export type MovementTraceRecordData = { kind: MovementTraceRecord["kind"] } & Record<string, unknown>;

export interface MovementTraceFile {
  format: "dc2d-movement-trace";
  version: 1;
  build: string;
  startedAt: string;
  durationMs: number;
  stopReason: "manual" | "timeout";
  metadata: MovementTraceMetadata & { userAgent: string };
  records: MovementTraceRecord[];
  truncated: boolean;
}

export interface SnapshotTraceInput {
  snapshot: ServerSnapshot;
  predictedBefore: BodyState | null;
  predictedAfter: BodyState | null;
  client: MovementTraceClientState;
}

export interface FrameTraceInput {
  time: number;
  input: MoveInput;
  render: TracePosition;
  client: MovementTraceClientState;
}

export function position(body: Pick<BodyState, "x" | "y" | "z"> | null): TracePosition | null {
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

export function inputTraceRecord(input: ClientInput, state: MovementTraceClientState): MovementTraceRecordData {
  return {
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
  };
}

export function snapshotTraceRecord(input: SnapshotTraceInput): MovementTraceRecordData {
  const { snapshot, predictedBefore, predictedAfter, client } = input;
  return {
    kind: "snapshot",
    snapshot: {
      tick: snapshot.tick,
      lastSeq: snapshot.lastSeq,
      lastProjectedServerTick: snapshot.lastProjectedServerTick,
      authoritativeBody: position(snapshot.self),
      stamina: snapshot.self.stamina ?? null,
      floor: snapshot.self.floor ?? null,
      events: snapshot.events.map((event) => event.t),
    },
    predictedBefore: position(predictedBefore),
    predictedAfter: position(predictedAfter),
    client: clientState(client),
  };
}

export function frameTraceRecord(input: FrameTraceInput): MovementTraceRecordData {
  return {
    kind: "frame",
    frameTime: input.time,
    input: {
      moveX: input.input.moveX,
      moveY: input.input.moveY,
      jump: input.input.jump,
      run: input.input.run ?? false,
      block: input.input.block ?? false,
    },
    render: { ...input.render },
    client: clientState(input.client),
  };
}
