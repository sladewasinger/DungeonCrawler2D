// Headless tests for the weapon-chip flicker debounce.
import { describe, expect, it } from "vitest";
import {
  WEAPON_UNEQUIP_HOLD_MS,
  initialWeaponDisplay,
  nextWeaponDisplay,
  type WeaponDisplayState,
} from "./weaponDisplayStability.js";

describe("nextWeaponDisplay", () => {
  it("commits a real equip instantly, no debounce", () => {
    const state = nextWeaponDisplay(initialWeaponDisplay(), "sword", 0);
    expect(state.id).toBe("sword");
  });

  it("swaps to a different weapon instantly too", () => {
    const armed: WeaponDisplayState = { id: "sword", nullSinceMs: null };
    const state = nextWeaponDisplay(armed, "hammer", 1000);
    expect(state.id).toBe("hammer");
  });

  it("holds the previous weapon through a brief single-frame unarmed reading", () => {
    let state: WeaponDisplayState = { id: "sword", nullSinceMs: null };
    state = nextWeaponDisplay(state, null, 1000);
    expect(state.id).toBe("sword"); // still displayed — within the hold window
    state = nextWeaponDisplay(state, "sword", 1050); // truth bounces back
    expect(state.id).toBe("sword");
  });

  it("commits to unarmed once null has been sustained past the hold window", () => {
    let state: WeaponDisplayState = { id: "sword", nullSinceMs: null };
    state = nextWeaponDisplay(state, null, 1000);
    state = nextWeaponDisplay(state, null, 1000 + WEAPON_UNEQUIP_HOLD_MS);
    expect(state.id).toBe(null);
  });

  it("starts unarmed with no debounce needed", () => {
    expect(initialWeaponDisplay().id).toBe(null);
  });
});
