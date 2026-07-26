import { describe, expect, it } from "vitest";
import { deathOverlayText } from "./deathOverlay.js";

describe("death overlay copy", () => {
  it("shows the authoritative countdown and instant-respawn help", () => {
    expect(deathOverlayText(29.2)).toBe(
      "YOU DIED\nRespawning in 30s\nHold [E] for 3s to respawn now",
    );
  });
});
