/** Verifies idle snapshot traffic halves while events and nearby movement retain burst cadence. */
import { describe, expect, it } from "vitest";
import type { PlayerSnapshotFrame } from "../playerSnapshot.js";
import { shouldSendSnapshot } from "./snapshotCadence.js";

function frame(tick: number): PlayerSnapshotFrame {
  return {
    tick,
    lastSeq: 0,
    lastProjectedServerTick: 0,
    self: {
      x: 0, y: 0, z: 0, zVel: 0, grounded: true,
      coyoteTime: 0, jumpBuffer: 0, jumpHeld: false, kx: 0, ky: 0,
      hp: 30, maxHp: 30, fx: [],
    },
    weapon: null,
    party: null,
    entities: [],
    left: [],
    events: [],
    areas: [],
    roomDoors: [],
    miniBossArenaGates: [],
    defeatedMiniBossArenas: [],
    visibleIds: new Set(),
    privateEventCount: 0,
    pendingEventCount: 0,
    pendingAreaKeys: [],
    includesFullAreas: false,
    areaAoiCenter: { x: 0, y: 0 },
  };
}

describe("shouldSendSnapshot", () => {
  it("sends odd ticks for baselines, events, and moving AOI entities", () => {
    expect(shouldSendSnapshot(frame(1), true)).toBe(true);
    expect(shouldSendSnapshot({ ...frame(1), events: [{ t: "toast", msg: "now" }] }, false)).toBe(true);
    expect(shouldSendSnapshot({
      ...frame(1),
      entities: [{ revision: 1, snapshot: { id: "p2", kind: "player", x: 1, y: 0, z: 0, vx: 2 } }],
    }, false)).toBe(true);
  });

  it("caps CorpNet dynamic frames at the base cadence without delaying critical state", () => {
    const moving: PlayerSnapshotFrame = {
      ...frame(1),
      entities: [{ revision: 1, snapshot: { id: "p2", kind: "player", x: 1, y: 0, z: 0, vx: 2 } }],
    };
    expect(shouldSendSnapshot(moving, false, "corpnet")).toBe(false);
    expect(shouldSendSnapshot({ ...moving, tick: 2 }, false, "corpnet")).toBe(true);
    expect(shouldSendSnapshot(moving, true, "corpnet")).toBe(true);
    expect(shouldSendSnapshot({ ...moving, events: [{ t: "toast", msg: "now" }] }, false, "corpnet")).toBe(true);
    expect(shouldSendSnapshot({ ...moving, areas: [{ x: 1, y: 1, defId: "area-fire" }] }, false, "corpnet")).toBe(true);
    expect(shouldSendSnapshot({ ...moving, left: ["p2"] }, false, "corpnet")).toBe(true);
  });
});
