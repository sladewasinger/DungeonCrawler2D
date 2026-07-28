import { createBody, type ClientInput, type ServerSnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  MOVEMENT_TRACE_MAX_MS,
  MovementTraceRecorder,
  type MovementTraceClientState,
} from "./movementTrace.js";

const state = (): MovementTraceClientState => ({
  status: "connected",
  serverTick: 50,
  rttMs: 12,
  projectedTick: 52,
  pendingSteps: 2,
  correctionError: 0.25,
  body: createBody(4, 5, 0),
});

const input: ClientInput = {
  type: "input",
  seq: 7,
  projectedServerTick: 52,
  moveX: 1,
  moveY: 0,
  jump: false,
  run: true,
};

const snapshot = {
  type: "snapshot",
  tick: 50,
  lastSeq: 6,
  lastProjectedServerTick: 51,
  self: {
    x: 3.5,
    y: 5,
    z: 0,
    zVel: 0,
    grounded: true,
    coyoteTime: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    kx: 0,
    ky: 0,
    hp: 30,
    maxHp: 30,
    fx: [],
  },
  inventory: [],
  hotbar: [],
  weapon: null,
  party: null,
  entities: [],
  left: [],
  events: [{ t: "teleported" }],
  areas: [],
} satisfies ServerSnapshot;

describe("MovementTraceRecorder", () => {
  it("records movement-only wire and render evidence in one bounded file", () => {
    const recorder = new MovementTraceRecorder();
    expect(recorder.start({
      endpoint: "ws://localhost:8787",
      worldSeed: 123,
      floor: 1,
      voidTerrain: false,
    }, 1_000)).toBe(true);

    recorder.recordInput(input, state());
    recorder.recordSnapshot({
      snapshot,
      predictedBefore: createBody(4, 5, 0),
      predictedAfter: createBody(3.75, 5, 0),
      client: state(),
    });
    recorder.recordFrame({ time: 1_050, input, render: { x: 4.1, y: 5, z: 0 }, client: state() });
    const trace = recorder.stop("manual", 1_100);

    expect(trace).toMatchObject({
      format: "dc2d-movement-trace",
      version: 2,
      durationMs: 100,
      stopReason: "manual",
      metadata: {
        endpoint: "ws://localhost:8787",
        worldSeed: 123,
        floor: 1,
        voidTerrain: false,
      },
      truncated: false,
    });
    expect(trace?.records.map((record) => record.kind))
      .toEqual(["input", "snapshot", "frame"]);
    expect(JSON.stringify(trace)).not.toContain("inventory");
    expect(JSON.stringify(trace)).not.toContain("chat");
  });

  it("exposes the automatic sixty-second stop boundary", () => {
    const recorder = new MovementTraceRecorder();
    recorder.start({ endpoint: "ws://test", worldSeed: null, floor: 1, voidTerrain: null }, 500);

    expect(recorder.timedOut(500 + MOVEMENT_TRACE_MAX_MS - 1)).toBe(false);
    expect(recorder.timedOut(500 + MOVEMENT_TRACE_MAX_MS)).toBe(true);
  });
});
