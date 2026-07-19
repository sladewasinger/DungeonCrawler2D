import { describe, expect, it } from "vitest";
import {
  createSelfCosmeticsState,
  isSelfAttacking,
  triggerSelfAttack,
  updateSelfFacing,
} from "./selfCosmetics.js";

describe("updateSelfFacing", () => {
  it("adopts a nonzero move direction", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, -1, 0);
    expect(state.faceX).toBe(-1);
    expect(state.faceY).toBe(0);
  });

  it("holds the last facing while idle", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, -1, 1);
    updateSelfFacing(state, 0, 0);
    expect(state.faceX).toBe(-1);
    expect(state.faceY).toBe(1);
  });
});

describe("attack pulse", () => {
  it("reads as attacking immediately after trigger, and not once it elapses", () => {
    const state = createSelfCosmeticsState();
    triggerSelfAttack(state, 1000);
    expect(isSelfAttacking(state, 1000)).toBe(true);
    expect(isSelfAttacking(state, 1100)).toBe(true);
    expect(isSelfAttacking(state, 1200)).toBe(false);
  });

  it("defaults to not attacking before any trigger", () => {
    const state = createSelfCosmeticsState();
    expect(isSelfAttacking(state, 0)).toBe(false);
  });
});
