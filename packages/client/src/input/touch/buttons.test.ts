// Headless tests: touch button press/release bookkeeping stays multi-touch safe
// (a second finger can't steal a button another finger is already holding).
import { describe, expect, it } from "vitest";
import { isButtonHeld, pressButton, releaseAllForPointer, releaseButton } from "./buttons.js";
import { createTouchInputState } from "./state.js";

describe("pressButton / releaseButton", () => {
  it("claims a button for the pressing pointer", () => {
    const state = createTouchInputState();
    pressButton(state, "attack", 1);
    expect(isButtonHeld(state, "attack")).toBe(true);
    expect(state.buttons.attack).toBe(1);
  });

  it("a second finger can't steal a button the first finger already holds", () => {
    const state = createTouchInputState();
    pressButton(state, "jump", 1);
    pressButton(state, "jump", 2);
    expect(state.buttons.jump).toBe(1);
  });

  it("release only clears the button if the releasing pointer owns it", () => {
    const state = createTouchInputState();
    pressButton(state, "interact", 1);
    releaseButton(state, "interact", 2);
    expect(isButtonHeld(state, "interact")).toBe(true);
    releaseButton(state, "interact", 1);
    expect(isButtonHeld(state, "interact")).toBe(false);
  });

  it("attack and jump can be held by two different fingers at once (attack while moving)", () => {
    const state = createTouchInputState();
    pressButton(state, "jump", 1);
    pressButton(state, "attack", 2);
    expect(isButtonHeld(state, "jump")).toBe(true);
    expect(isButtonHeld(state, "attack")).toBe(true);
  });
});

describe("releaseAllForPointer", () => {
  it("releases every button held by the given pointer, leaving others' held state intact", () => {
    const state = createTouchInputState();
    pressButton(state, "attack", 1);
    pressButton(state, "jump", 1);
    pressButton(state, "interact", 2);
    releaseAllForPointer(state, 1);
    expect(isButtonHeld(state, "attack")).toBe(false);
    expect(isButtonHeld(state, "jump")).toBe(false);
    expect(isButtonHeld(state, "interact")).toBe(true);
  });
});
