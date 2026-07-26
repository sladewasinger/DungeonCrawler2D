import { describe, expect, it } from "vitest";
import { deathOverlayText, downedOverlayText } from "./deathOverlay.js";

describe("death overlay copy", () => {
  it("shows the authoritative countdown and instant-respawn help", () => {
    expect(deathOverlayText(29.2)).toBe(
      "YOU DIED\nRespawning in 30s\nHold [E] for 3s to respawn now",
    );
  });

  it("shares authoritative downed countdown and reviver copy", () => {
    expect(downedOverlayText(29.2, null)).toContain("Bleeding out in 30s");
    expect(downedOverlayText(12, "Austin")).toContain("Austin is reviving you");
  });
});
