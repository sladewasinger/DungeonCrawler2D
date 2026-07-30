import { describe, expect, it } from "vitest";
import type { ServerSnapshot, ServerSnapshotDelta } from "@dc2d/engine";
import { SnapshotCoalescer } from "./snapshotCoalescer.js";

interface DeltaOptions {
  readonly baseline?: boolean;
  readonly baseTick?: number | null;
  readonly events?: ServerSnapshotDelta["events"];
  readonly areas?: ServerSnapshotDelta["areas"];
  readonly left?: ServerSnapshotDelta["left"];
}

function delta(tick: number, options: DeltaOptions = {}): ServerSnapshotDelta {
  const baseline = options.baseline === true;
  return {
    type: "snapshotDelta",
    tick,
    baseTick: deltaBaseTick(tick, options),
    baseline,
    lastSeq: tick,
    lastProjectedServerTick: tick,
    self: {
      x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0,
      jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0, hp: 1, maxHp: 1, fx: [],
    },
    inventoryRevision: 0,
    ...baselineInventory(baseline),
    hotbarRevision: 0,
    weapon: null,
    party: null,
    entities: [],
    left: optionalList(options.left),
    events: optionalList(options.events),
    areas: optionalList(options.areas),
  };
}

function deltaBaseTick(
  tick: number,
  options: DeltaOptions,
): number | null {
  if (options.baseTick !== undefined) return options.baseTick;
  return options.baseline === true ? null : tick - 1;
}

function baselineInventory(
  baseline: boolean,
): Pick<ServerSnapshotDelta, "inventory" | "hotbar"> | object {
  return baseline ? { inventory: [], hotbar: [] } : {};
}

function optionalList<T>(value: T[] | undefined): T[] {
  return value ?? [];
}

function fullSnapshot(tick: number): ServerSnapshot {
  return {
    type: "snapshot",
    tick,
    lastSeq: tick,
    lastProjectedServerTick: tick,
    self: {
      x: 0, y: 0, z: 0, zVel: 0, grounded: true, coyoteTime: 0,
      jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0, hp: 1, maxHp: 1, fx: [],
    },
    inventory: [],
    hotbar: [],
    weapon: null,
    party: null,
    entities: [],
    left: [],
    events: [],
    areas: [],
  };
}

describe("SnapshotCoalescer", () => {
  it("retains an ordered short delta chain", () => {
    const coalescer = new SnapshotCoalescer(2);
    coalescer.enqueue({ message: delta(1), receivedAtMs: 10 });
    coalescer.enqueue({ message: delta(2), receivedAtMs: 20 });

    expect(coalescer.drain().map(({ message }) => message.tick)).toEqual([1, 2]);
  });

  it("flushes a full dynamic batch before accepting another dynamic delta", () => {
    const coalescer = new SnapshotCoalescer(1);
    coalescer.enqueue({ message: delta(1), receivedAtMs: 10 });

    expect(coalescer.enqueue({ message: delta(2), receivedAtMs: 20 }))
      .toEqual({ queued: false, flushImmediately: true });
    expect(coalescer.drain().map(({ message }) => message.tick)).toEqual([1]);
    expect(coalescer.enqueue({ message: delta(2), receivedAtMs: 20 }))
      .toEqual({ queued: true, flushImmediately: false });
    expect(coalescer.drain().map(({ message }) => message.tick)).toEqual([2]);
  });

  const criticalOptions: Array<[string, DeltaOptions]> = [
    ["event", { events: [{ t: "toast", msg: "Recovered" }] }],
    ["area change", { areas: [{ x: 0, y: 0, defId: "area-fire" }] }],
    ["entity leave", { left: ["enemy-1"] }],
    ["baseline", { baseline: true }],
    ["baseline-equivalent", { baseTick: null }],
  ];

  it.each(criticalOptions)("flushes queued dynamics with a critical %s snapshot", (_name, options) => {
    const coalescer = new SnapshotCoalescer(2);
    coalescer.enqueue({ message: delta(1), receivedAtMs: 10 });
    coalescer.enqueue({ message: delta(2), receivedAtMs: 20 });

    expect(coalescer.enqueue({ message: delta(3, options), receivedAtMs: 30 }))
      .toEqual({ queued: true, flushImmediately: true });
    expect(coalescer.drain().map(({ message }) => message.tick)).toEqual([1, 2, 3]);
  });

  it("flushes queued dynamics with a full snapshot", () => {
    const coalescer = new SnapshotCoalescer(1);
    coalescer.enqueue({ message: delta(1), receivedAtMs: 10 });

    expect(coalescer.enqueue({ message: fullSnapshot(2), receivedAtMs: 20 }))
      .toEqual({ queued: true, flushImmediately: true });
    expect(coalescer.drain().map(({ message }) => message.tick)).toEqual([1, 2]);
  });
});
