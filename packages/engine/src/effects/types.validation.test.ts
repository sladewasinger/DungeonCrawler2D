import { describe, expect, it } from "vitest";
import { buildContentRegistry, type RawContent } from "./types.js";

function minimalRaw(overrides: Partial<RawContent> = {}): RawContent {
  return { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [], ...overrides };
}

function areaDef(
  id: string,
  tags: string[],
  channel: "surface" | "flame" | "gas",
) {
  return {
    id,
    tags,
    channel,
    priority: 10,
    buoyancy: 0,
    duration: 5,
    sprite: id,
  };
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

  it("rejects area reactions outside the known area vocabulary", () => {
    const raw = minimalRaw({
      areas: [areaDef("fire", ["fire"], "flame")],
      areaReactions: [{
        id: "bad-reaction",
        priority: 10,
        when: ["fire", "imaginary-fuel"],
        actions: [{ op: "add", area: "imaginary-area" }],
      }],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unknown area tag/);
  });

  it("rejects reaction source tags that are not matched inputs", () => {
    const raw = minimalRaw({
      areas: [
        areaDef("fire", ["fire"], "flame"),
        areaDef("oil", ["oil"], "surface"),
        areaDef("poison", ["poison"], "gas"),
      ],
      areaReactions: [{
        id: "bad-source",
        priority: 10,
        when: ["fire", "oil"],
        actions: [{ op: "add", area: "fire", sourceFromTag: "poison" }],
      }],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/unmatched area tag "poison"/);
  });

  it("rejects duplicate status ids", () => {
    const status = { id: "burning", name: "Burning", kind: "debuff" as const, tags: [], duration: 5, stacking: "refresh" as const };
    expect(() => buildContentRegistry(minimalRaw({ statuses: [status, status] }))).toThrow(/duplicate status/);
  });

  it("rejects duplicate area ids", () => {
    const fire = areaDef("fire", ["fire"], "flame");
    expect(() => buildContentRegistry(minimalRaw({ areas: [fire, fire] })))
      .toThrow(/duplicate area fire/);
  });

  it("bounds declarative area duration and tag counts", () => {
    const tooLong = {
      ...areaDef("lasting-fire", ["fire"], "flame"),
      duration: 301,
    };
    const tooManyTags = areaDef(
      "verbose-fire",
      Array.from({ length: 13 }, (_, index) => `tag-${index}`),
      "flame",
    );
    expect(() => buildContentRegistry(minimalRaw({ areas: [tooLong] })))
      .toThrow();
    expect(() => buildContentRegistry(minimalRaw({ areas: [tooManyTags] })))
      .toThrow();
  });

  it("rejects a direct area self-refresh transition", () => {
    const raw = minimalRaw({
      areas: [
        areaDef("fire", ["fire"], "flame"),
        areaDef("oil", ["oil"], "surface"),
      ],
      areaReactions: [{
        id: "refresh-fire",
        priority: 10,
        when: ["fire", "oil"],
        actions: [
          { op: "remove", tag: "fire" },
          { op: "add", area: "fire" },
        ],
      }],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/directly self-refreshes/);
  });

  it("rejects a cycle across area transition reactions", () => {
    const raw = minimalRaw({
      areas: [
        areaDef("form-a", ["form-a"], "surface"),
        areaDef("form-b", ["form-b"], "surface"),
        areaDef("catalyst", ["catalyst"], "gas"),
      ],
      areaReactions: [
        transformReaction("a-to-b", "form-a", "form-b"),
        transformReaction("b-to-a", "form-b", "form-a"),
      ],
    });
    expect(() => buildContentRegistry(raw)).toThrow(/transition cycle/);
  });

  it("allows non-transitioning rate consumption", () => {
    const raw = minimalRaw({
      areas: [
        areaDef("fire", ["fire"], "flame"),
        areaDef("oil", ["oil"], "surface"),
      ],
      areaReactions: [{
        id: "burn-oil",
        priority: 10,
        when: ["fire", "oil"],
        actions: [{ op: "rate_consume", tag: "oil", perSecond: 2 }],
      }],
    });
    expect(() => buildContentRegistry(raw)).not.toThrow();
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

function transformReaction(id: string, tag: string, area: string) {
  return {
    id,
    priority: 10,
    when: [tag, "catalyst"],
    actions: [{ op: "transform", tag, area }],
  };
}
