// Headless test for the stash window's viewport-aware panel width (wave-6 playtest:
// "barely any screen real estate") — pure geometry math, no Phaser scene required.
import { describe, expect, it } from "vitest";
import { resolvePanelWidth } from "./stashWindow.js";

describe("resolvePanelWidth", () => {
  it("uses the full designed width on an ordinary desktop/tablet viewport", () => {
    expect(resolvePanelWidth({ width: 1280, height: 800 })).toBe(440);
  });

  it("shrinks to fit a narrow phone-portrait viewport with margin to spare", () => {
    const width = resolvePanelWidth({ width: 390, height: 844 });
    expect(width).toBeLessThan(390);
    expect(width).toBe(390 - 64);
  });

  it("never returns a width that leaves less than the required breathing-room margin", () => {
    for (const viewportWidth of [320, 375, 390, 412, 428, 600, 900]) {
      const width = resolvePanelWidth({ width: viewportWidth, height: 800 });
      expect(viewportWidth - width).toBeGreaterThanOrEqual(64);
    }
  });

  it("never exceeds the designed max width even on a very narrow viewport", () => {
    expect(resolvePanelWidth({ width: 300, height: 800 })).toBeLessThanOrEqual(440);
  });
});
