/** Verifies contextual tutorials trigger from authoritative player actions and health edges. */
import { describe, expect, it } from "vitest";
import {
  advanceTutorials,
  createTutorialState,
  type TutorialSnapshot,
} from "./model.js";

const snapshot = (
  patch: Partial<TutorialSnapshot> = {},
): TutorialSnapshot => ({
  inventory: [
    { item: "torch", qty: 3 },
    { item: "bandage", qty: 2 },
  ],
  hotbar: ["torch", "bandage", null, null, null, null, null, null, null],
  selectedSlot: null,
  hp: 30,
  maxHp: 30,
  ...patch,
});

describe("contextual tutorials", () => {
  it("teaches hotbar selection on hydration without inferring an item action", () => {
    const state = createTutorialState();
    expect(advanceTutorials(state, snapshot())).toEqual([{
      id: "hotbar",
      text: "Press [1–9] to select a hotbar item.",
      persistent: true,
    }]);
    expect(advanceTutorials(state, snapshot({
      hotbar: ["torch", "bandage", "rag", null, null, null, null, null, null],
    }))).toEqual([]);
  });

  it("teaches actions only after selecting a populated slot", () => {
    const state = createTutorialState();
    advanceTutorials(state, snapshot());
    expect(advanceTutorials(state, snapshot({ selectedSlot: 0 }))).toEqual([{
      id: "throwable",
      text: "Press [G] to throw the selected item.",
      persistent: true,
    }]);
    expect(advanceTutorials(state, snapshot({ selectedSlot: 0 }))).toEqual([]);
    expect(advanceTutorials(state, snapshot({ selectedSlot: 1 }))).toEqual([{
      id: "usable",
      text: "Press [E] to apply the selected bandage.",
      persistent: true,
    }]);
    expect(advanceTutorials(state, snapshot({
      selectedSlot: 2,
      hotbar: ["torch", "bandage", "rag", null, null, null, null, null, null],
    }))).toEqual([]);
  });

  it("teaches inventory after a real pickup rather than initial hydration", () => {
    const state = createTutorialState();
    advanceTutorials(state, snapshot());
    const messages = advanceTutorials(state, snapshot({
      inventory: [
        { item: "torch", qty: 3 },
        { item: "bandage", qty: 2 },
        { item: "rag", qty: 1 },
      ],
    }));
    expect(messages).toEqual([{
      id: "inventory",
      text: "Press [Tab] to open your inventory.",
      persistent: true,
    }]);
  });

  it("warns only on a post-hydration low-health edge with a bandage available", () => {
    const state = createTutorialState();
    expect(advanceTutorials(state, snapshot({ hp: 8 }))).toHaveLength(1);
    expect(advanceTutorials(state, snapshot({ hp: 20 }))).toEqual([]);
    expect(advanceTutorials(state, snapshot({ hp: 8 }))).toEqual([{
      id: "low-health",
      text: "Health low! Press [2], then [E] to heal.",
      persistent: false,
    }]);
    expect(advanceTutorials(state, snapshot({ hp: 7 }))).toEqual([]);

    const unavailable = createTutorialState();
    advanceTutorials(unavailable, snapshot({
      inventory: [{ item: "torch", qty: 3 }],
      hp: 30,
    }));
    expect(advanceTutorials(unavailable, snapshot({
      inventory: [{ item: "torch", qty: 3 }],
      hp: 8,
    }))).toEqual([]);
  });

  it("uses touch controls for selection, throwing, and healing", () => {
    const state = createTutorialState();
    expect(advanceTutorials(state, snapshot(), "touch")).toEqual([{
      id: "hotbar",
      text: "Tap [1–9] to select a hotbar item.",
      persistent: true,
    }]);
    expect(advanceTutorials(
      state,
      snapshot({ selectedSlot: 0 }),
      "touch",
    )).toEqual([{
      id: "throwable",
      text: "Tap [THROW] to throw the selected item.",
      persistent: true,
    }]);
    expect(advanceTutorials(
      state,
      snapshot({ selectedSlot: 1 }),
      "touch",
    )).toEqual([{
      id: "usable",
      text: "Tap [USE] to apply the selected bandage.",
      persistent: true,
    }]);
  });
});
