import { describe, expect, it } from "vitest";
import type { EntitySnapshot } from "@dc2d/engine";
import { interpolated, recordSample, type RemoteEntity } from "./interpolate.js";

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
});
