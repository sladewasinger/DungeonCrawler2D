import { describe, expect, it } from "vitest";
import { directProjectileIsBlocked } from "./projectiles.js";

describe("directProjectileIsBlocked", () => {
  it("blocks a direct enemy projectile while the target is blocking", () => {
    expect(directProjectileIsBlocked(undefined, true)).toBe(true);
  });

  it("does not block item explosions or area impacts", () => {
    expect(directProjectileIsBlocked("vodka-bottle", true)).toBe(false);
    expect(directProjectileIsBlocked("torch", true)).toBe(false);
  });

  it("does not suppress direct projectiles when blocking is inactive", () => {
    expect(directProjectileIsBlocked(undefined, false)).toBe(false);
  });

  it("only blocks projectiles arriving inside the guard cone", () => {
    expect(directProjectileIsBlocked(undefined, true, 1, 0, 1, 0)).toBe(true);
    expect(directProjectileIsBlocked(undefined, true, 1, 0, -1, 0)).toBe(false);
  });
});
