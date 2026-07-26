import { describe, expect, it } from "vitest";
import {
  DEATH_HEADLINE_COLOR,
  DEATH_HEADLINE_OUTLINE,
  deathOverlayPresentation,
  deathOverlayText,
  downedOverlayText,
  respawnButtonVisible,
} from "./deathOverlay.js";

describe("death overlay copy", () => {
  it("shows the authoritative countdown and instant-respawn help", () => {
    expect(deathOverlayText(29.2)).toBe(
      "YOU DIED\nRespawning in 30s\nHold [E] for 3s to respawn now",
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

  it("shows direct respawn only for the fully dead state", () => {
    expect(respawnButtonVisible(false, true)).toBe(true);
    expect(respawnButtonVisible(true, false)).toBe(false);
    expect(respawnButtonVisible(false, false)).toBe(false);
  });

  it("shares authoritative downed countdown and reviver copy", () => {
    expect(downedOverlayText(29.2, null)).toContain("Bleeding out in 30s");
    expect(downedOverlayText(12, "Austin")).toContain("Austin is reviving you");
  });
});
