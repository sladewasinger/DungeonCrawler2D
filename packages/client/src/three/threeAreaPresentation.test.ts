import { describe, expect, it } from "vitest";
import { threeAreaPresentation } from "./threeAreaPresentation.js";

describe("Three area presentation", () => {
  it("keeps damaging and utility areas visually distinct", () => {
    const fire = threeAreaPresentation("area-fire");
    const poison = threeAreaPresentation("area-poison");
    const wet = threeAreaPresentation("area-wet");
    expect(new Set([fire.color, poison.color, wet.color]).size).toBe(3);
    expect(fire.opacity).toBeGreaterThan(wet.opacity);
  });

  it("gives unknown authoritative areas a visible fallback", () => {
    expect(threeAreaPresentation("future-area")).toMatchObject({
      color: "#a98bca",
      opacity: 0.42,
    });
  });
});
