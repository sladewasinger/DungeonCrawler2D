import { describe, expect, it } from "vitest";
import { nextViewDistance } from "./viewDistance.js";

describe("nextViewDistance", () => {
  it("cycles through all supported terrain ranges", () => {
    expect(nextViewDistance(18)).toBe(26);
    expect(nextViewDistance(26)).toBe(34);
    expect(nextViewDistance(34)).toBe(18);
  });
});
