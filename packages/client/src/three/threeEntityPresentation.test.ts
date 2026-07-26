import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { threeEntityPresentation } from "./threeEntityPresentation.js";

const snapshot = (
  kind: EntitySnapshot["kind"],
  defId?: string,
): EntitySnapshot => ({ id: "e", kind, defId, x: 0, y: 0, z: 0 });

describe("Three world entity presentation", () => {
  it("gives pickups content-readable colors and a bounded bob", () => {
    expect(threeEntityPresentation(snapshot("item", "bandage"))).toMatchObject({
      kind: "item",
      color: "#78c890",
      bob: true,
      scale: 0.13,
    });
  });

  it("keeps projectiles emissive and distinct from pickups", () => {
    expect(threeEntityPresentation(snapshot("projectile", "fire-potion")))
      .toMatchObject({
        kind: "projectile",
        color: "#ffad55",
        bob: false,
        spin: true,
      });
  });

  it("renders placed torches upright and non-spinning", () => {
    expect(threeEntityPresentation({
      ...snapshot("torch", "torch"),
      state: "placed",
    })).toMatchObject({
      kind: "torch",
      elevation: 0.24,
      spin: false,
    });
  });

  it("renders death loot as a labelled, grounded chest", () => {
    expect(threeEntityPresentation({
      ...snapshot("item", "player-loot-chest"),
      lootOwnerName: "Crawler 123",
      lootKillerName: "Crawler 456",
      lootUnlockAtTick: 1_220,
    })).toMatchObject({
      kind: "lootChest",
      label: "[DEAD] Crawler 123's loot\nKilled by Crawler 456",
      unlockAtTick: 1_220,
      bob: false,
      spin: false,
    });
  });

  it("leaves players and enemies to the animated actor renderer", () => {
    expect(threeEntityPresentation(snapshot("player"))).toBeNull();
    expect(threeEntityPresentation(snapshot("enemy"))).toBeNull();
  });
});
