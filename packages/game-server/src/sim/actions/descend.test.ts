import { describe, expect, it } from "vitest";
import type { PlayerSlot, SimState } from "../state/state.js";
import { doDescend } from "./descend.js";

describe("accepted floor descent", () => {
  it("emits an immediate transition acknowledgement before transfer preparation", () => {
    const slot = {
      pendingTransfer: null,
      entity: { body: { x: 10, y: 10 } },
      outbox: [],
    } as unknown as PlayerSlot;
    const sim = {
      world: {
        floor: 1,
        downStairwayPositions: () => [{ x: 10, y: 10 }],
      },
    } as unknown as SimState;

    doDescend(sim, slot);

    expect(slot.pendingTransfer).toEqual({ targetFloor: 2, arrival: "stairUp" });
    expect(slot.outbox).toContainEqual({ t: "floorTransition", floor: 2 });
  });
});
