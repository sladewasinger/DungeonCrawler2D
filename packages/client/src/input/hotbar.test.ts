// Headless tests for hotbar/throwable/panel-number-key resolution.
import { describe, expect, it } from "vitest";
import { activateHotbar, activeThrowableSlot, onNumberKey, throwPreview } from "./hotbar.js";
import type { InputConnection, InputPanels, InputQueries, InputState, Keys } from "./state.js";

function makeConn(overrides: Partial<InputConnection> = {}): InputConnection {
  const calls: string[] = [];
  return {
    body: { x: 0, y: 0 },
    canAct: true,
    hotbar: ["sword", "bomb", undefined],
    inventory: [{ item: "sword" }],
    stash: undefined,
    pendingInvite: false,
    interact: () => calls.push("interact"),
    pickup: () => calls.push("pickup"),
    attack: () => calls.push("attack"),
    useSlot: () => calls.push("useSlot"),
    craft: () => calls.push("craft"),
    stashOp: () => calls.push("stashOp"),
    partyOp: () => calls.push("partyOp"),
    ...overrides,
  };
}

function makeQueries(overrides: Partial<InputQueries> = {}): InputQueries {
  return {
    isThrowable: (id) => id === "bomb",
    recipeIdAt: () => undefined,
    nearestPlayerId: () => undefined,
    isStashNearby: () => true,
    isCraftTableNearby: () => true,
    ...overrides,
  };
}

function makeState(): InputState {
  return {
    keys: {} as Keys,
    cursors: {} as InputState["cursors"],
    nextSwingAt: 0,
    selectedThrowable: null,
  };
}

describe("activateHotbar", () => {
  it("arms a throwable slot instead of using it immediately", () => {
    const state = makeState();
    const conn = makeConn();
    activateHotbar(state, conn, makeQueries(), 1);
    expect(state.selectedThrowable).toBe(1);
  });

  it("toggles the same throwable slot off on a second press", () => {
    const state = makeState();
    const conn = makeConn();
    const queries = makeQueries();
    activateHotbar(state, conn, queries, 1);
    activateHotbar(state, conn, queries, 1);
    expect(state.selectedThrowable).toBeNull();
  });

  it("uses a non-throwable slot immediately without arming it", () => {
    const state = makeState();
    const used: number[] = [];
    const conn = makeConn({ useSlot: (i) => used.push(i) });
    activateHotbar(state, conn, makeQueries(), 0);
    expect(used).toEqual([0]);
    expect(state.selectedThrowable).toBeNull();
  });

  it("does nothing for an empty slot", () => {
    const state = makeState();
    const conn = makeConn();
    activateHotbar(state, conn, makeQueries(), 2);
    expect(state.selectedThrowable).toBeNull();
  });
});

describe("activeThrowableSlot / throwPreview", () => {
  it("clears the armed slot if its item stops being a throwable (e.g. consumed)", () => {
    const state = makeState();
    state.selectedThrowable = 1;
    const conn = makeConn({ hotbar: ["sword", undefined, undefined] });
    expect(activeThrowableSlot(state, conn, makeQueries())).toBeNull();
    expect(state.selectedThrowable).toBeNull();
  });

  it("builds a world-space preview for an armed throwable", () => {
    const state = makeState();
    state.selectedThrowable = 1;
    const conn = makeConn();
    const preview = throwPreview(state, conn, makeQueries(), { x: 3.5, y: 2 });
    expect(preview).toEqual({ slot: 1, targetX: 3.5, targetY: 2 });
  });

  it("returns null when no slot is armed", () => {
    const state = makeState();
    const conn = makeConn();
    expect(throwPreview(state, conn, makeQueries(), { x: 0, y: 0 })).toBeNull();
  });
});

describe("onNumberKey", () => {
  const panelsClosed: InputPanels = {
    craftOpen: false,
    stashOpen: false,
    openStashIfNearby: () => {},
    toggleCraft: () => {},
    closeAll: () => {},
  };

  it("falls back to hotbar activation when no panel is open", () => {
    const state = makeState();
    const used: number[] = [];
    const conn = makeConn({ useSlot: (i) => used.push(i) });
    onNumberKey(state, conn, panelsClosed, makeQueries(), { SHIFT: { isDown: false } } as Keys, 1);
    expect(used).toEqual([0]);
  });

  it("crafts the recipe at that slot when the craft panel is open near a table", () => {
    const state = makeState();
    const crafted: string[] = [];
    const conn = makeConn({ craft: (id) => crafted.push(id) });
    const panels: InputPanels = { ...panelsClosed, craftOpen: true };
    const queries = makeQueries({ recipeIdAt: () => "recipe-1" });
    onNumberKey(state, conn, panels, queries, { SHIFT: { isDown: false } } as Keys, 1);
    expect(crafted).toEqual(["recipe-1"]);
  });

  it("takes from the stash on a plain number when the stash panel is open near a stash", () => {
    const state = makeState();
    const ops: Array<[string, number]> = [];
    const conn = makeConn({ stash: {}, stashOp: (op, i) => ops.push([op, i]) });
    const panels: InputPanels = { ...panelsClosed, stashOpen: true };
    onNumberKey(state, conn, panels, makeQueries(), { SHIFT: { isDown: false } } as Keys, 2);
    expect(ops).toEqual([["take", 1]]);
  });

  it("puts the matching inventory stack into the stash on shift+number", () => {
    const state = makeState();
    const ops: Array<[string, number]> = [];
    const conn = makeConn({
      stash: {},
      hotbar: ["sword", undefined, undefined],
      inventory: [{ item: "bomb" }, { item: "sword" }],
      stashOp: (op, i) => ops.push([op, i]),
    });
    const panels: InputPanels = { ...panelsClosed, stashOpen: true };
    onNumberKey(state, conn, panels, makeQueries(), { SHIFT: { isDown: true } } as Keys, 1);
    expect(ops).toEqual([["put", 1]]);
  });
});
