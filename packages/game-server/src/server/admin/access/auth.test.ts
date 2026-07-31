import { describe, expect, it } from "vitest";
import { adminTokenMatches } from "./auth.js";

describe("admin token boundary", () => {
  it("accepts only the exact configured secret", () => {
    expect(adminTokenMatches("correct", "correct")).toBe(true);
    expect(adminTokenMatches("wrong", "correct")).toBe(false);
    expect(adminTokenMatches("correct", null)).toBe(false);
  });
});
