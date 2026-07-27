import { describe, expect, it } from "vitest";
import { buildContentRegistry, type RawContent } from "./types.js";

function minimalRaw(overrides: Partial<RawContent> = {}): RawContent {
  return { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [], ...overrides };
}

describe("buildContentRegistry validation", () => {
  it("rejects a status primitive with an unknown status", () => {
    const raw = minimalRaw({ statuses: [{ id: "curse", name: "Curse", kind: "debuff", tags: [], duration: 5, stacking: "refresh", onTick: [{ primitive: "apply_status", status: "nonexistent" }] }] });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown status/);
  });

  it("rejects a primitive with an unknown area", () => {
    const raw = minimalRaw({ statuses: [{ id: "curse", name: "Curse", kind: "debuff", tags: [], duration: 5, stacking: "refresh", onApply: [{ primitive: "spawn_area", area: "nonexistent", radius: 1 }] }] });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown area/);
  });

  it("rejects duplicate status ids", () => {
    const status = { id: "burning", name: "Burning", kind: "debuff" as const, tags: [], duration: 5, stacking: "refresh" as const };
    expect(() => buildContentRegistry(minimalRaw({ statuses: [status, status] }))).toThrow(/duplicate status/);
  });

  it("rejects enemy drops for an unknown item", () => {
    const enemy = { id: "slime", name: "Slime", tags: [], hp: 10, speed: 1, aggroRadius: 5, attack: { damage: 1, range: 1, cooldown: 1 }, drops: [{ item: "nonexistent", chance: 1 }], sprite: "enemy_slime" };
    expect(() => buildContentRegistry(minimalRaw({ enemies: [enemy] }))).toThrow(/unknown item/);
  });

  it("rejects recipe input/output items that do not exist", () => {
    const recipes = [{ id: "bad", inputs: [{ item: "nonexistent", qty: 1 }], output: { item: "wood", qty: 1 } }];
    expect(() => buildContentRegistry(minimalRaw({ recipes }))).toThrow(/unknown item/);
  });
});
