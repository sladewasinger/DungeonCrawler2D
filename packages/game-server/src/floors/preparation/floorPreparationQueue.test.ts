import type { GameSim } from "../../sim/core/index.js";
import type { FloorTransferRequest } from "../../sim/state/domainTypes.js";
import { describe, expect, it } from "vitest";
import { FloorPreparationQueue } from "./floorPreparationQueue.js";

describe("FloorPreparationQueue", () => {
  it("defers preparation work and waits for the shared floor promise", async () => {
    const queue = new FloorPreparationQueue();
    const request = {
      slot: { entity: { id: "player-1" } },
      pets: [],
      targetFloor: 2,
      arrival: "stairUp",
    } as unknown as FloorTransferRequest;
    let calls = 0;

    queue.defer(request, 2, async () => {
      calls += 1;
      return {} as GameSim;
    });

    expect(calls).toBe(0);
    expect(queue.takePending()).toEqual([request]);
    await queue.waitForPending();
    expect(calls).toBe(1);
  });

  it("shares one preparation across concurrent transfers to the same floor", async () => {
    const queue = new FloorPreparationQueue();
    const request = (id: string) => ({
      slot: { entity: { id } }, pets: [], targetFloor: 2, arrival: "stairUp",
    } as unknown as FloorTransferRequest);
    let calls = 0;

    queue.defer(request("player-1"), 2, async () => {
      calls += 1;
      return {} as GameSim;
    });
    queue.defer(request("player-2"), 2, async () => {
      calls += 1;
      return {} as GameSim;
    });

    expect(queue.takePending()).toHaveLength(2);
    await queue.waitForPending();
    expect(calls).toBe(1);
  });
});
