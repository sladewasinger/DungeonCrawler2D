import { describe, expect, it } from "vitest";
import { bossDownFlashAlpha, bossDownTextAlpha, isBossDownExpired } from "./bossDownFlourishMotion.js";

describe("isBossDownExpired", () => {
  it("is false through the lifetime and true after it", () => {
    expect(isBossDownExpired(0)).toBe(false);
    expect(isBossDownExpired(2199)).toBe(false);
    expect(isBossDownExpired(2200)).toBe(true);
  });
});

describe("bossDownFlashAlpha", () => {
  it("starts bright and fades to 0 by the flash window's end", () => {
    expect(bossDownFlashAlpha(0)).toBe(1);
    expect(bossDownFlashAlpha(350)).toBe(0);
    expect(bossDownFlashAlpha(1000)).toBe(0);
  });
});

describe("bossDownTextAlpha", () => {
  it("pops in, holds at 1, then fades out to exactly 0 at the lifetime end", () => {
    expect(bossDownTextAlpha(0)).toBe(0);
    expect(bossDownTextAlpha(200)).toBe(1);
    expect(bossDownTextAlpha(1000)).toBe(1);
    expect(bossDownTextAlpha(2200)).toBe(0);
  });
});
