import { describe, expect, it } from "vitest";
import { INSTANT_RESPAWN_HOLD_MS, RespawnGesture } from "./respawn.js";

describe("instant respawn hold", () => {
  it("reports progress and fires once at three seconds", () => {
    const gesture = new RespawnGesture();
    gesture.begin(true, 100);
    expect(gesture.progress(true, 1_600)).toBe(0.5);
    expect(gesture.poll(true, 100 + INSTANT_RESPAWN_HOLD_MS - 1)).toBe(false);
    expect(gesture.poll(true, 100 + INSTANT_RESPAWN_HOLD_MS)).toBe(true);
    expect(gesture.poll(true, 100 + INSTANT_RESPAWN_HOLD_MS + 1)).toBe(false);
  });

  it("cancels on release or when death state ends", () => {
    const gesture = new RespawnGesture();
    gesture.begin(true, 0);
    gesture.end(500);
    expect(gesture.poll(true, INSTANT_RESPAWN_HOLD_MS)).toBe(false);
    gesture.begin(true, 4_000);
    expect(gesture.poll(false, 5_000)).toBe(false);
  });

  it("starts from the held source when the press edge was missed", () => {
    const gesture = new RespawnGesture();
    expect(gesture.poll(true, 100, true)).toBe(false);
    expect(gesture.progress(true, 1_600)).toBe(0.5);
    expect(gesture.poll(true, 100 + INSTANT_RESPAWN_HOLD_MS, true)).toBe(true);
  });
});
