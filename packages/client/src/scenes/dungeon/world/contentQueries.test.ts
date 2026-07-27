import { describe, expect, it } from "vitest";
import {
  categoryOfItem,
  isThrowableItem,
  itemName,
  nearestDownedPartyMember,
  nearestEntityId,
  recipeIdAtIndex,
  weaponCooldownMs,
} from "./contentQueries.js";

describe("isThrowableItem", () => {
  it("is true for a throwable item like the torch", () => {
    expect(isThrowableItem("torch")).toBe(true);
  });

  it("is false for a non-throwable item and for an unknown id", () => {
    expect(isThrowableItem("bandage")).toBe(false);
    expect(isThrowableItem("nonexistent")).toBe(false);
  });
});
describe("weaponCooldownMs", () => {
  it("uses each weapon's data-driven attack cadence", () => {
    expect(weaponCooldownMs("knife", 400)).toBe(240);
    expect(weaponCooldownMs("sword", 400)).toBe(350);
  });

  it("uses the fallback while unarmed or for an unknown item", () => {
    expect(weaponCooldownMs(null, 400)).toBe(400);
    expect(weaponCooldownMs("nonexistent", 400)).toBe(400);
  });
});

describe("categoryOfItem", () => {
  it("puts only weapons in the weapons tab", () => {
    expect(categoryOfItem("sword")).toBe("weapons");
  });

  it("puts consumables and non-weapon throwables in the usables tab", () => {
    expect(categoryOfItem("bandage")).toBe("usables");
    expect(categoryOfItem("vodka-bottle")).toBe("usables");
    expect(categoryOfItem("torch")).toBe("usables");
  });

  it("falls back to materials for everything else, including unknown ids", () => {
    expect(categoryOfItem("rag")).toBe("materials");
    expect(categoryOfItem("nonexistent")).toBe("materials");
  });
});

describe("itemName", () => {
  it("resolves a known item's display name", () => {
    expect(itemName("sword")).toBe("Rusty Sword");
  });

  it("falls back to the raw id for an unknown item", () => {
    expect(itemName("nonexistent")).toBe("nonexistent");
  });
});

describe("recipeIdAtIndex", () => {
  it("resolves a known recipe index", () => {
    expect(recipeIdAtIndex(0)).toBe("bandage");
  });

  it("returns undefined out of range", () => {
    expect(recipeIdAtIndex(999)).toBeUndefined();
  });
});

describe("nearestEntityId", () => {
  const entities = [
    { id: "a", kind: "player", x: 1, y: 0 },
    { id: "b", kind: "player", x: 5, y: 0 },
    { id: "c", kind: "enemy", x: 0.5, y: 0 },
  ];

  it("finds the nearest entity of the requested kind within range", () => {
    expect(nearestEntityId({ entities, kind: "player", fromX: 0, fromY: 0, maxDistance: 10 })).toBe("a");
  });

  it("ignores entities of other kinds", () => {
    expect(nearestEntityId({ entities, kind: "enemy", fromX: 0, fromY: 0, maxDistance: 10 })).toBe("c");
  });

  it("returns undefined when nothing is within range", () => {
    expect(nearestEntityId({ entities, kind: "player", fromX: 0, fromY: 0, maxDistance: 0.5 })).toBeUndefined();
  });
});

describe("nearestDownedPartyMember", () => {
  const members = [
    { id: "a", x: 1, y: 0, downed: false },
    { id: "b", x: 1.2, y: 0, downed: true },
    { id: "c", x: 5, y: 0, downed: true },
  ];

  it("ignores conscious members even when closer", () => {
    expect(nearestDownedPartyMember({ members, fromX: 0, fromY: 0, maxDistance: 10 })?.id).toBe("b");
  });

  it("returns undefined when no downed member is within range", () => {
    expect(nearestDownedPartyMember({ members, fromX: 0, fromY: 0, maxDistance: 1 })).toBeUndefined();
  });

  it("returns undefined with no party members at all", () => {
    expect(nearestDownedPartyMember({ members: [], fromX: 0, fromY: 0, maxDistance: 10 })).toBeUndefined();
  });

  it("breaks equal-distance ties by stable member id", () => {
    const tied = [
      { id: "later", x: -1, y: 0, downed: true },
      { id: "earlier", x: 1, y: 0, downed: true },
    ];
    expect(nearestDownedPartyMember({ members: tied, fromX: 0, fromY: 0, maxDistance: 10 })?.id).toBe("earlier");
  });
});
