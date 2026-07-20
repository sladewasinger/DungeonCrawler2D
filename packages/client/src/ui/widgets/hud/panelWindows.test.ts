// Headless test for the touch "tap outside a window closes it" decision — pure logic,
// no Phaser scene required (the widgets themselves aren't unit-tested, see hud/*.ts's
// shared "not routed through hitTest" doc comments).
import { describe, expect, it } from "vitest";
import { shouldDismissOnOutsideTap } from "./panelWindows.js";

describe("shouldDismissOnOutsideTap", () => {
  it("dismisses on touch when a window is open", () => {
    expect(shouldDismissOnOutsideTap(true, true)).toBe(true);
  });

  it("never dismisses on desktop — [Esc] already owns this", () => {
    expect(shouldDismissOnOutsideTap(false, true)).toBe(false);
  });

  it("is a no-op on touch when nothing is open — nothing to dismiss", () => {
    expect(shouldDismissOnOutsideTap(true, false)).toBe(false);
  });

  it("is a no-op on desktop with nothing open", () => {
    expect(shouldDismissOnOutsideTap(false, false)).toBe(false);
  });
});
