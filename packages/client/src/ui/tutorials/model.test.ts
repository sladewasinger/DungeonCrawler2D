/** Verifies contextual tutorials trigger from state transitions without repeating continuously. */
import { describe, expect, it } from "vitest";
import { advanceTutorials, createTutorialState, type TutorialSnapshot } from "./model.js";

const snapshot = (
  patch: Partial<TutorialSnapshot> = {},
): TutorialSnapshot => ({
  inventory: [{ item: "bandage", qty: 2 }],
  hotbar: ["bandage", null, null, null, null, null, null, null, null],
  hp: 30,
  maxHp: 30,
  ...patch,
});

describe("contextual tutorials", () => {
  it("teaches the starter bandage binding once", () => {
    const state = createTutorialState();
    expect(advanceTutorials(state, snapshot())).toEqual([
      {
        id: "usable",
        text: "Press [1] to equip, then [E] to apply the bandage.",
        persistent: true,
      },
    ]);
    expect(advanceTutorials(state, snapshot())).toEqual([]);
  });

  it("teaches inventory after a real pickup rather than initial hydration", () => {
    const state = createTutorialState();
    advanceTutorials(state, snapshot());
    const messages = advanceTutorials(state, snapshot({
      inventory: [{ item: "bandage", qty: 2 }, { item: "rag", qty: 1 }],
    }));
    expect(messages.map((message) => message.id)).toContain("inventory");
  });

  it("teaches throwable selection with its dedicated key", () => {
    const state = createTutorialState();
    advanceTutorials(state, snapshot());
    const messages = advanceTutorials(state, snapshot({
      hotbar: ["bandage", "torch", null, null, null, null, null, null, null],
    }));
    expect(messages).toContainEqual({
      id: "throwable",
      text: "Press [G] to throw the selected item.",
      persistent: true,
    });
  });

  it("warns once per low-health episode with the bound bandage slot", () => {
    const state = createTutorialState();
    advanceTutorials(state, snapshot());
    expect(advanceTutorials(state, snapshot({ hp: 8 }))).toContainEqual({
      id: "low-health",
      text: "Health low! Press [1], then [E] to heal.",
      persistent: false,
    });
    expect(advanceTutorials(state, snapshot({ hp: 7 }))).toEqual([]);
    advanceTutorials(state, snapshot({ hp: 20 }));
    expect(advanceTutorials(state, snapshot({ hp: 5 }))).toHaveLength(1);
  });
});
