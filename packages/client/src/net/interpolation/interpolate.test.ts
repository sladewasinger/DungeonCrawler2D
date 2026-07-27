import { describe, expect, it } from "vitest";
import type { EntitySnapshot } from "@dc2d/engine";
import {
  MAX_EXTRAPOLATION_MS,
  REMOTE_SAMPLE_HISTORY_MS,
  interpolateInto,
  interpolated,
  recordSample,
  type RemoteEntity,
} from "./interpolate.js";

function snap(x: number): EntitySnapshot {
  return { id: "e1", kind: "player", x, y: 0, z: 0 };
}

describe("interpolate", () => {
  it("lerps between the two samples that straddle the render time", () => {
    const remote: RemoteEntity = { snap: snap(0), samples: [] };
    recordSample(remote, 0, snap(0));
    recordSample(remote, 100, snap(10));

    const entities = new Map([["e1", remote]]);
    // now=100, delay=50 -> render at t=50, halfway between the samples.
    const [result] = interpolated(entities, 50, 100);

    expect(result?.x).toBeCloseTo(5);
  });

  it("clamps to the oldest sample when the render time predates it", () => {
    const remote: RemoteEntity = { snap: snap(0), samples: [] };
    recordSample(remote, 500, snap(10));
    const entities = new Map([["e1", remote]]);

    const [result] = interpolated(entities, 1000, 500);

    expect(result?.x).toBe(10);
  });

  it("drops samples older than one second", () => {
    const remote: RemoteEntity = { snap: snap(0), samples: [] };
    recordSample(remote, 0, snap(1));
    recordSample(remote, 1500, snap(2));

    expect(remote.samples).toHaveLength(1);
    expect(remote.samples[0]?.x).toBe(2);
  });

  it("recycles warmed sample records during sustained snapshot traffic", () => {
    const remote: RemoteEntity = { snap: snap(0), samples: [] };
    const identities = new Set<object>();
    const snapshotIntervalMs = 50;
    const snapshotCount = 5 * 60 * 20;

    for (let index = 0; index < snapshotCount; index++) {
      recordSample(remote, index * snapshotIntervalMs, snap(index));
      for (const sample of remote.samples) identities.add(sample);
    }

    const warmHistorySize =
      Math.floor(REMOTE_SAMPLE_HISTORY_MS / snapshotIntervalMs) + 1;
    expect(remote.samples.length).toBe(warmHistorySize);
    expect(identities.size).toBe(warmHistorySize);
    expect(remote.samples.at(-1)?.x).toBe(snapshotCount - 1);
  });

  it("extrapolates velocity across jitter without exceeding the safety horizon", () => {
    const moving = { ...snap(3), y: 4, vx: 2, vy: -1 };
    const remote: RemoteEntity = { snap: moving, samples: [] };
    recordSample(remote, 100, moving);
    const entities = new Map([["e1", remote]]);

    const [result] = interpolated(entities, 0, 100 + MAX_EXTRAPOLATION_MS + 100);

    expect(result?.x).toBeCloseTo(3 + 2 * MAX_EXTRAPOLATION_MS / 1000);
    expect(result?.y).toBeCloseTo(4 - MAX_EXTRAPOLATION_MS / 1000);
    expect(result?.z).toBe(0);
  });

  it("keeps multiple actors convergent across one lost update and irregular arrival", () => {
    const right: RemoteEntity = { snap: { ...snap(3), vx: 1 }, samples: [] };
    const left: RemoteEntity = {
      snap: { ...snap(-3), id: "e2", vx: -1 },
      samples: [],
    };
    for (const [remote, direction] of [[right, 1], [left, -1]] as const) {
      recordSample(remote, 0, { ...remote.snap, x: 0 });
      recordSample(remote, 100, { ...remote.snap, x: direction * 0.1 });
      recordSample(remote, 300, { ...remote.snap, x: direction * 0.3 });
    }
    const entities = new Map([["e1", right], ["e2", left]]);

    const duringGap = interpolated(entities, 100, 250);
    const afterJitter = interpolated(entities, 100, 450);
    const afterLongLoss = interpolated(entities, 100, 650);

    expect(duringGap.map((actor) => actor.x)).toEqual([0.15, -0.15]);
    expect(afterJitter.map((actor) => actor.x)).toEqual([0.35, -0.35]);
    expect(afterLongLoss[0]?.x).toBeCloseTo(0.45);
    expect(afterLongLoss[1]?.x).toBeCloseTo(-0.45);
  });

  it("reuses one bounded set of frame records across sustained rendering", () => {
    const entities = new Map<string, RemoteEntity>();
    for (let index = 0; index < 20; index++) {
      const entitySnap = { ...snap(index), id: `e${index}`, vx: 1 };
      const remote: RemoteEntity = { snap: entitySnap, samples: [] };
      recordSample(remote, 0, entitySnap);
      recordSample(remote, 100, { ...entitySnap, x: index + 0.1 });
      entities.set(entitySnap.id, remote);
    }
    const frame: ReturnType<typeof interpolated> = [];
    const recordIdentities = new Set<object>();

    for (let renderFrame = 0; renderFrame < 300; renderFrame++) {
      const result = interpolateInto({
        entities,
        delayMs: 75,
        now: 100 + renderFrame * (1000 / 60),
        out: frame,
      });
      expect(result).toBe(frame);
      for (const entity of result) recordIdentities.add(entity);
    }

    expect(recordIdentities.size).toBe(entities.size);
    entities.delete("e19");
    expect(interpolateInto({ entities, delayMs: 75, now: 200, out: frame })).toHaveLength(19);
  });
});
