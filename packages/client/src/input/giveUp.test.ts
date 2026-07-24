/** Verifies that voluntary death requires one complete, non-repeating hold gesture. */
import { describe, expect, it } from "vitest";
import { GIVE_UP_HOLD_MS, GiveUpGesture } from "./giveUp.js";

describe("give-up hold gesture", () => {
  it("fires once only after the full hold duration", () => {
    const gesture = new GiveUpGesture();
    gesture.begin(true, 100);

    expect(gesture.progress(true, 100 + GIVE_UP_HOLD_MS / 2)).toBe(0.5);
    expect(gesture.poll(true, 100 + GIVE_UP_HOLD_MS - 1)).toBe(false);
    expect(gesture.poll(true, 100 + GIVE_UP_HOLD_MS)).toBe(true);
    expect(gesture.poll(true, 100 + GIVE_UP_HOLD_MS + 1)).toBe(false);
  });

  it("cancels when released or when the player is no longer downed", () => {
    const gesture = new GiveUpGesture();
    gesture.begin(true, 0);
    gesture.end(100);
    expect(gesture.poll(true, GIVE_UP_HOLD_MS)).toBe(false);

    gesture.begin(true, 2_000);
    expect(gesture.poll(false, 2_100)).toBe(false);
    expect(gesture.poll(true, 2_000 + GIVE_UP_HOLD_MS)).toBe(false);
  });

  it("does not begin while the player is standing", () => {
    const gesture = new GiveUpGesture();
    gesture.begin(false, 0);
    expect(gesture.poll(true, GIVE_UP_HOLD_MS)).toBe(false);
  });
});
