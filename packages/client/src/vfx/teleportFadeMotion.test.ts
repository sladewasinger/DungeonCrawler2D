import { describe, expect, it } from "vitest";
import { isTeleportFadeExpired, teleportFadeAlpha } from "./teleportFadeMotion.js";

describe("isTeleportFadeExpired", () => {
  it("is false through the lifetime and true after it", () => {
    expect(isTeleportFadeExpired(0)).toBe(false);
    expect(isTeleportFadeExpired(499)).toBe(false);
    expect(isTeleportFadeExpired(500)).toBe(true);
  });
});

describe("teleportFadeAlpha", () => {
  it("fades to fully opaque, holds, then fades back to transparent by the end", () => {
    expect(teleportFadeAlpha(0)).toBe(0);
    expect(teleportFadeAlpha(120)).toBe(1);
    expect(teleportFadeAlpha(200)).toBe(1);
    expect(teleportFadeAlpha(499)).toBeGreaterThan(0);
    expect(teleportFadeAlpha(500)).toBe(0);
  });
});
