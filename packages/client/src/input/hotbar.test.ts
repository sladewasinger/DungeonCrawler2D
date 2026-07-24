// Headless tests for hotbar/throwable/panel-number-key resolution.
import { describe, expect, it } from "vitest";
import { activateHotbar, activeThrowableSlot, onNumberKey, throwPreview } from "./hotbar.js";
import type { InputConnection, InputPanels, InputQueries, InputState, Keys } from "./state.js";

function makeConn(overrides: Partial<InputConnection> = {}): InputConnection {
  const calls: string[] = [];
  return {
    body: { x: 0, y: 0 },
    canAct: true,
    downed: false,
    hotbar: ["sword", "bomb", undefined],
    inventory: [{ item: "sword", qty: 1 }],
    stash: undefined,
    pendingInvite: false,
    weapon: null,
    interact: () => calls.push("interact"),
    pickup: () => calls.push("pickup"),
    attack: () => calls.push("attack"),
    useSlot: () => calls.push("useSlot"),
    useItem: () => calls.push("useItem"),
    throwTorch: () => calls.push("throwTorch"),
    craft: () => calls.push("craft"),
    stashOp: () => calls.push("stashOp"),
    partyOp: () => calls.push("partyOp"),
    assignSlot: () => calls.push("assignSlot"),
    equip: () => calls.push("equip"),
    drop: () => calls.push("drop"),
    fistbump: () => calls.push("fistbump"),
    descend: () => calls.push("descend"),
    suicide: () => calls.push("suicide"),
    pushToast: () => calls.push("pushToast"),
    ...overrides,
  };
}

function makeQueries(overrides: Partial<InputQueries> = {}): InputQueries {
  return {
    isThrowable: (id) => id === "bomb",
    isConsumable: (id) => id === "potion",
    attackCooldownMs: () => 350,
    recipeIdAt: () => undefined,
    nearestPlayerId: () => undefined,
    isStashNearby: () => true,
    isCraftTableNearby: () => true,
    isDoorNearby: () => false,
    isStairwayNearby: () => false,
    downedPartyMemberInRange: () => undefined,
    ...overrides,
  };
}

function makeState(): InputState {
  return {
    keys: {} as Keys,
    cursors: {} as InputState["cursors"],
    nextSwingAt: 0,
    selectedSlot: null,
  };
}

describe("activateHotbar", () => {
  it("selects a throwable slot instead of using it immediately", () => {
    const state = makeState();
    const conn = makeConn();
    activateHotbar(state, conn, 1);
    expect(state.selectedSlot).toBe(1);
  });

  it("toggles the same throwable slot off on a second press", () => {
    const state = makeState();
    const conn = makeConn();
    activateHotbar(state, conn, 1);
    activateHotbar(state, conn, 1);
    expect(state.selectedSlot).toBeNull();
  });

  it("selects a non-throwable slot without using it", () => {
    const state = makeState();
    const used: number[] = [];
    const conn = makeConn({ useSlot: (i) => used.push(i) });
    activateHotbar(state, conn, 0);
    expect(used).toEqual([]);
    expect(state.selectedSlot).toBe(0);
  });

  it("does nothing for an empty slot", () => {
    const state = makeState();
    const conn = makeConn();
    activateHotbar(state, conn, 2);
    expect(state.selectedSlot).toBeNull();
  });
});

describe("activeThrowableSlot / throwPreview", () => {
  it("returns null if the selected item is no longer throwable", () => {
    const state = makeState();
    state.selectedSlot = 1;
    const conn = makeConn({ hotbar: ["sword", undefined, undefined] });
    expect(activeThrowableSlot(state, conn, makeQueries())).toBeNull();
    expect(state.selectedSlot).toBe(1);
  });

  it("builds a world-space preview for an armed throwable", () => {
    const state = makeState();
    state.selectedSlot = 1;
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
    inventoryOpen: false,
    selectedInventoryItem: null,
    openStashIfNearby: () => {},
    toggleCraft: () => {},
    closeAll: () => {},
  };

  it("binds the selected inventory row to that slot when the inventory window is open with a row selected", () => {
    const state = makeState();
    const bound: Array<[number, string | null]> = [];
    const conn = makeConn({ assignSlot: (slot, item) => bound.push([slot, item]) });
    const panels: InputPanels = { ...panelsClosed, inventoryOpen: true, selectedInventoryItem: "bomb" };
    onNumberKey(state, conn, panels, makeQueries(), { SHIFT: { isDown: false } } as Keys, 3);
    expect(bound).toEqual([[2, "bomb"]]);
  });

  it("falls back to hotbar activation when the inventory is open but nothing is selected", () => {
    const state = makeState();
    const conn = makeConn();
    const panels: InputPanels = { ...panelsClosed, inventoryOpen: true, selectedInventoryItem: null };
    onNumberKey(state, conn, panels, makeQueries(), { SHIFT: { isDown: false } } as Keys, 1);
    expect(state.selectedSlot).toBe(0);
  });

  it("falls back to hotbar activation when no panel is open", () => {
    const state = makeState();
    const conn = makeConn();
    onNumberKey(state, conn, panelsClosed, makeQueries(), { SHIFT: { isDown: false } } as Keys, 1);
    expect(state.selectedSlot).toBe(0);
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
      inventory: [{ item: "bomb", qty: 1 }, { item: "sword", qty: 1 }],
      stashOp: (op, i) => ops.push([op, i]),
    });
    const panels: InputPanels = { ...panelsClosed, stashOpen: true };
    onNumberKey(state, conn, panels, makeQueries(), { SHIFT: { isDown: true } } as Keys, 1);
    expect(ops).toEqual([["put", 1]]);
  });
});
