/** Unit tests for SimScenario deterministic multi-tick simulation and persistence rebooting. */
import { describe, expect, it } from "vitest";
import { SimScenario } from "./simScenario.js";

describe("SimScenario headless harness [sim]", () => {
  it("steps movement deterministically across identical seeds and input streams", () => {
    const runPass = (): { readonly x: number; readonly y: number } => {
      const sc = SimScenario.create({ seed: 4242 });
      try {
        const p = sc.joinPlayer({ name: "Runner" });
        sc.sendInput(p.id, { moveX: 1, moveY: 0, aimX: 1, aimY: 0 }).stepSeconds(0.5);
        const state = sc.getPlayer(p.id)!;
        return { x: state.x, y: state.y };
      } finally {
        sc.dispose();
      }
    };
    const first = runPass();
    const second = runPass();
    expect(first.x).toBeGreaterThan(0.5);
    expect(second).toEqual(first);
  });

  it("persists player position and inventory across rebootFromPersistence()", () => {
    const sc = SimScenario.create({ seed: 1337 });
    let nextSc: SimScenario | undefined;
    try {
      const p = sc.joinPlayer({ name: "Survivor" });
      sc.getWorld().grantPlayerItems(p.id, [{ slot: 5, itemId: "wood", count: 8 }]);
      sc.sendAction(p.id, { t: "selectHotbar", slot: 5 });
      sc.sendInput(p.id, { moveX: 0.8, moveY: -0.4 }).tick(15);
      const before = sc.getPlayer(p.id)!;
      const beforeX = before.x;
      const beforeY = before.y;

      const rebooted = sc.rebootFromPersistence();
      nextSc = rebooted.scenario;
      const restoredHandle = rebooted.handles[0]!;
      const restored = nextSc.getPlayer(restoredHandle.id)!;
      expect(restored.x).toBeCloseTo(beforeX, 5);
      expect(restored.y).toBeCloseTo(beforeY, 5);
      expect(restored.inventory.slots[5]?.itemId).toBe("wood");
      expect(restored.inventory.slots[5]?.count).toBe(8);
    } finally {
      nextSc?.dispose();
      sc.dispose();
    }
  });
});
