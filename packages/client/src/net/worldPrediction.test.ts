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

  it("preserves local 360-degree aim and facing during server snapshot reconciliation", () => {
    const aimed = { ...createDefaultPlayer("p1"), facingX: 0.6, facingY: -0.8, aimX: 0.6, aimY: -0.8 };
    const staleServer = { ...createDefaultPlayer("p1"), facingX: 0, facingY: 1, aimX: 0, aimY: 1, x: 0.6 };

    const reconciled = reconcilePredictedPlayer(aimed, staleServer);
    expect(reconciled.aimX).toBeCloseTo(0.6, 3);
    expect(reconciled.aimY).toBeCloseTo(-0.8, 3);
    expect(reconciled.facingX).toBeCloseTo(0.6, 3);
    expect(reconciled.facingY).toBeCloseTo(-0.8, 3);
  });

  it("preserves local dropped elevation and jumpZ mid-fall during snapshot reconciliation", () => {
    const midDrop = { ...createDefaultPlayer("p1"), elevation: 0, jumpZ: 0.72, jumpVz: -1.5, x: -7.5, y: -5.8 };
    const staleServer = { ...createDefaultPlayer("p1"), elevation: 1, jumpZ: 0.2, jumpVz: 0.5, x: -7.5, y: -6.1 };

    const reconciled = reconcilePredictedPlayer(midDrop, staleServer);
    expect(reconciled.elevation).toBe(0);
    expect(reconciled.jumpZ).toBeCloseTo(0.72, 3);
    expect(reconciled.jumpVz).toBeCloseTo(-1.5, 3);
  });
});
