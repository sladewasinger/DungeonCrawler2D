// Throw-equipped input mapping: when the equipped weapon should throw instead of swing,
// and what direction that throw sends.
import { describe, expect, it } from "vitest";
import { equippedIsThrowable, equippedStackQty, throwDirToward } from "./throwEquipped.js";
import type { InputConnection, InputQueries } from "./state.js";

function makeConn(weapon: string | null, inventory: InputConnection["inventory"] = []): InputConnection {
  return {
    body: { x: 0, y: 0 },
    canAct: true,
    hotbar: [],
    inventory,
    stash: undefined,
    pendingInvite: false,
    weapon,
    interact: () => {},
    pickup: () => {},
    attack: () => {},
    useSlot: () => {},
    throwTorch: () => {},
    craft: () => {},
    stashOp: () => {},
    partyOp: () => {},
    assignSlot: () => {},
    equip: () => {},
    drop: () => {},
    fistbump: () => {},
    pushToast: () => {},
  };
}

const queries: InputQueries = {
  isThrowable: (id) => id === "torch",
  recipeIdAt: () => undefined,
  nearestPlayerId: () => undefined,
  isStashNearby: () => false,
  isCraftTableNearby: () => false,
  isDoorNearby: () => false,
  downedPartyMemberInRange: () => undefined,
};

describe("equippedIsThrowable", () => {
  it("is true when the equipped weapon is itself throwable", () => {
    expect(equippedIsThrowable(makeConn("torch"), queries)).toBe(true);
  });

  it("is false for a non-throwable equipped weapon (sword)", () => {
    expect(equippedIsThrowable(makeConn("sword"), queries)).toBe(false);
  });

  it("is false when unarmed", () => {
    expect(equippedIsThrowable(makeConn(null), queries)).toBe(false);
  });
});

describe("equippedStackQty", () => {
  it("reads the equipped item's remaining stack count", () => {
    expect(equippedStackQty(makeConn("torch", [{ item: "torch", qty: 2 }]))).toBe(2);
  });

  it("is 0 once the stack is gone (binding survives an empty stack)", () => {
    expect(equippedStackQty(makeConn("torch", []))).toBe(0);
  });

  it("is 0 when unarmed", () => {
    expect(equippedStackQty(makeConn(null))).toBe(0);
  });
});

describe("throwDirToward", () => {
  it("points from the body toward the cursor's world position", () => {
    expect(throwDirToward({ x: 2, y: 3 }, { x: 5, y: 1 })).toEqual({ dirX: 3, dirY: -2 });
  });

  it("is the zero vector when the cursor sits on the body", () => {
    expect(throwDirToward({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ dirX: 0, dirY: 0 });
  });
});
