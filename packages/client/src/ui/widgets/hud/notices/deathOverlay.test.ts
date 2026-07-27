import { describe, expect, it } from "vitest";
import {
  DEATH_HEADLINE_COLOR,
  DEATH_HEADLINE_OUTLINE,
  deathOverlayPresentation,
  deathOverlayText,
  downedOverlayText,
  giveUpButtonVisible,
} from "./deathOverlay.js";

describe("death overlay copy", () => {
  it("shows only the authoritative countdown while dead", () => {
    expect(deathOverlayText(29.2)).toBe(
      "YOU DIED\nRespawning in 30s",
    );
  });

  it("keeps the red outlined headline dominant and bands non-overlapping", () => {
    expect(DEATH_HEADLINE_COLOR).toBe("#ff304f");
    expect(DEATH_HEADLINE_OUTLINE).toBe("#240109");
    for (const [viewport, scale] of [
      [{ width: 1280, height: 720 }, 1],
      [{ width: 320, height: 180 }, 2],
      [{ width: 480, height: 240 }, 3],
    ] as const) {
      const layout = deathOverlayPresentation(viewport, scale);
      expect(layout.headlineSize).toBeGreaterThan(layout.detailSize * 2);
      expect(layout.headlineY).toBeLessThan(layout.timerY);
      expect(layout.timerY).toBeLessThan(layout.promptY);
      expect(layout.promptY).toBeLessThan(layout.barY);
      expect(layout.barY).toBeLessThan(layout.buttonY);
      expect(layout.barWidth * scale).toBeLessThanOrEqual(viewport.width);
      expect(layout.buttonWidth * scale).toBeLessThanOrEqual(viewport.width);
    }
  });

  it("shows direct give-up only for the downed state", () => {
    expect(giveUpButtonVisible(true, false)).toBe(true);
    expect(giveUpButtonVisible(false, true)).toBe(false);
    expect(giveUpButtonVisible(false, false)).toBe(false);
  });

  it("shares authoritative downed countdown and reviver copy", () => {
    expect(downedOverlayText(29.2, null)).toContain("Bleeding out in 30s");
    expect(downedOverlayText(29.2, null)).toContain("Hold [E] for 2s to give up");
    expect(downedOverlayText(12, "Austin")).toContain("Austin is reviving you");
  });
});
