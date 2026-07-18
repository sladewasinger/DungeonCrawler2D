// Content schemas are the AI-crafting contract: valid content parses cleanly, and every
// cross-reference/duplicate-id check in buildContentRegistry rejects nonsense content.
import { describe, expect, it } from "vitest";
import { buildContentRegistry, type RawContent } from "./types.js";

function minimalRaw(overrides: Partial<RawContent> = {}): RawContent {
  return {
    statuses: [],
    rules: [],
    areas: [],
    items: [],
    enemies: [],
    recipes: [],
    ...overrides,
  };
}

describe("buildContentRegistry", () => {
  it("accepts valid content spanning every domain and cross-reference", () => {
    const registry = buildContentRegistry({
      statuses: [
        {
          id: "burning",
          name: "Burning",
          kind: "debuff",
          tags: ["fire"],
          duration: 5,
          tickEvery: 1,
          stacking: "refresh",
          onTick: [{ primitive: "modify_health", amount: -1 }],
        },
      ],
      rules: [{ when: ["fire", "wet"], removeTags: ["fire"], apply: "burning" }],
      areas: [
        {
          id: "fire_pool",
          tags: ["fire"],
          buoyancy: 0,
          duration: 10,
          onEnterStatus: "burning",
          sprite: "area_fire",
        },
      ],
      items: [
        {
          id: "torch",
          name: "Torch",
          tags: [],
          maxStack: 1,
          throwable: {
            onImpact: [{ primitive: "spawn_area", area: "fire_pool", radius: 1 }],
            breakChance: 1,
          },
          weapon: { damage: 2, applies: [{ status: "burning", chance: 0.5 }] },
        },
        { id: "wood", name: "Wood", tags: [], maxStack: 99 },
      ],
      enemies: [
        {
          id: "slime",
          name: "Slime",
          tags: [],
          hp: 10,
          speed: 1,
          aggroRadius: 5,
          attack: { damage: 1, range: 1, cooldown: 1, applies: [{ status: "burning", chance: 0.2 }] },
          drops: [{ item: "wood", chance: 1 }],
          sprite: "enemy_slime",
        },
      ],
      recipes: [{ id: "make_torch", inputs: [{ item: "wood", qty: 1 }], output: { item: "torch", qty: 1 } }],
    });

    expect(registry.statuses.get("burning")?.kind).toBe("debuff");
    expect(registry.rules).toHaveLength(1);
    expect(registry.areas.has("fire_pool")).toBe(true);
    expect(registry.items.has("torch")).toBe(true);
    expect(registry.enemies.get("slime")?.hp).toBe(10);
    expect(registry.recipes.get("make_torch")?.output.item).toBe("torch");
  });

  it("throws when a status onTick primitive references an unknown status", () => {
    const raw = minimalRaw({
      statuses: [
        {
          id: "curse",
          name: "Curse",
          kind: "debuff",
          tags: [],
          duration: 5,
          stacking: "refresh",
          onTick: [{ primitive: "apply_status", status: "nonexistent" }],
        },
      ],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown status/);
  });

  it("throws when a primitive references an unknown area", () => {
    const raw = minimalRaw({
      statuses: [
        {
          id: "curse",
          name: "Curse",
          kind: "debuff",
          tags: [],
          duration: 5,
          stacking: "refresh",
          onApply: [{ primitive: "spawn_area", area: "nonexistent", radius: 1 }],
        },
      ],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown area/);
  });

  it("throws when two statuses share the same id", () => {
    const status = {
      id: "burning",
      name: "Burning",
      kind: "debuff" as const,
      tags: [],
      duration: 5,
      stacking: "refresh" as const,
    };
    const raw = minimalRaw({ statuses: [status, status] });
    expect(() => buildContentRegistry(raw)).toThrow(/duplicate status/);
  });

  it("throws when an enemy drops an unknown item", () => {
    const raw = minimalRaw({
      enemies: [
        {
          id: "slime",
          name: "Slime",
          tags: [],
          hp: 10,
          speed: 1,
          aggroRadius: 5,
          attack: { damage: 1, range: 1, cooldown: 1 },
          drops: [{ item: "nonexistent", chance: 1 }],
          sprite: "enemy_slime",
        },
      ],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown item/);
  });

  it("throws when a recipe uses an unknown input or output item", () => {
    const raw = minimalRaw({
      recipes: [{ id: "bad", inputs: [{ item: "nonexistent", qty: 1 }], output: { item: "wood", qty: 1 } }],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown item/);
  });
});
