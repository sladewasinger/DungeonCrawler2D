import { describe, expect, it } from "vitest";
import { resolveContextualActionHelp } from "./actionHelp.js";

describe("resolveContextualActionHelp", () => {
  it("advertises the actual use key for a selected consumable", () => {
    expect(resolveContextualActionHelp({
      selectedItemId: "bandage",
      weaponId: null,
    })).toEqual([{
      action: "use",
      key: "E",
      touchKey: "USE",
      label: "Use Bandage",
    }]);
  });

  it("advertises the actual throw key for a selected throwable", () => {
    expect(resolveContextualActionHelp({
      selectedItemId: "torch",
      weaponId: null,
    })).toEqual([{
      action: "throw",
      key: "G",
      touchKey: "THROW",
      label: "Hold to aim, release to throw Torch",
      touchLabel: "Throw Torch",
    }]);
  });

  it("advertises attack for an equipped weapon without inventing block state", () => {
    expect(resolveContextualActionHelp({
      selectedItemId: null,
      weaponId: "sword",
    })).toEqual([{
      action: "attack",
      key: "LMB",
      touchKey: "ATTACK",
      label: "Attack with Rusty Sword",
    }]);
  });

  it("adds block only when an authoritative capability opts in", () => {
    const actions = resolveContextualActionHelp({
      selectedItemId: null,
      weaponId: "sword",
      canBlock: true,
    });
    expect(actions.map(({ action }) => action)).toEqual(["attack", "block"]);
    expect(actions[1]).toMatchObject({
      key: "RMB",
      touchKey: "BLOCK",
      label: "Block with Rusty Sword",
    });
  });

  it("returns no help without a selected action item or equipped weapon", () => {
    expect(resolveContextualActionHelp({
      selectedItemId: null,
      weaponId: null,
    })).toEqual([]);
  });
});
