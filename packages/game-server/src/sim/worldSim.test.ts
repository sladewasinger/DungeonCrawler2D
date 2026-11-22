import { describe, expect, it } from "vitest";
import { WorldSim } from "./worldSim.js";

describe("WorldSim", () => {
  it("moves players deterministically, toggles torches, and syncs Day/Night", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Scout");
    const before = sim.snapshots()[0];
    expect(before?.torchLit).toBe(true);

    sim.queueInput(id, { seq: 1, moveX: 0, moveY: 1 });
    for (let i = 0; i < 10; i++) sim.step();

    const moved = sim.snapshots()[0];
    expect(moved?.y).toBeGreaterThan(before?.y ?? 0);
    expect(moved?.lastAckSeq).toBe(1);

    sim.toggleTorch(id);
    expect(sim.snapshots()[0]?.torchLit).toBe(false);

    sim.setDayPhase(0.95, true);
    sim.step();
    expect(sim.dayPhase).toBeCloseTo(0.95, 4);
    expect(sim.dayPaused).toBe(true);
  });
});
