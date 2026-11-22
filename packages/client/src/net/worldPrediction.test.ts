import { describe, expect, it } from "vitest";
import { createDefaultPlayer, reconcilePredictedPlayer } from "./worldPrediction.js";

describe("worldPrediction", () => {
  it("updates local player id and name to server assignment even within reconciliation threshold", () => {
    const local = createDefaultPlayer("local");
    const serverP2 = { ...createDefaultPlayer("p2"), name: "Adventurer", x: 0.9, y: 0.5, heldItem: "sword" };

    const reconciled = reconcilePredictedPlayer(local, serverP2);
    expect(reconciled.id).toBe("p2");
    expect(reconciled.name).toBe("Adventurer");
    expect(reconciled.heldItem).toBe("sword");
    expect(reconciled.x).toBeCloseTo(0.58, 3);
  });

  it("snaps cleanly when prediction diverges beyond threshold", () => {
    const local = createDefaultPlayer("p1");
    const serverFar = { ...createDefaultPlayer("p2"), name: "Wanderer", x: 4.0, y: 2.0 };

    const reconciled = reconcilePredictedPlayer(local, serverFar);
    expect(reconciled.id).toBe("p2");
    expect(reconciled.x).toBe(4.0);
    expect(reconciled.y).toBe(2.0);
  });
});
