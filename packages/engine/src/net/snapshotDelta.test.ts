import { describe, expect, it } from "vitest";
import {
  decodeServerMessage,
  encodeMessage,
  type ServerSnapshotDelta,
} from "./messages.js";

describe("snapshot delta protocol", () => {
  it("round-trips a complete negotiated baseline", () => {
    const delta: ServerSnapshotDelta = {
      type: "snapshotDelta",
      tick: 42,
      baseTick: null,
      baseline: true,
      lastSeq: 7,
      self: {
        x: 1,
        y: 2,
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
      inventoryRevision: 2,
      inventory: [{ item: "bandage", qty: 2 }],
      hotbarRevision: 1,
      hotbar: ["bandage"],
      weapon: "sword",
      party: null,
      entities: [{
        id: "e1",
        kind: "enemy",
        defId: "slime",
        x: 2,
        y: 3,
        z: 0,
        revision: 4,
      }],
      left: [],
      events: [],
      areas: [],
    };
    expect(decodeServerMessage(encodeMessage(delta))).toEqual(delta);
  });
});
