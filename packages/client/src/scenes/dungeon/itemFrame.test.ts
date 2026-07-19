import { describe, expect, it } from "vitest";
import { groundItemFrame } from "./itemFrame.js";

describe("groundItemFrame", () => {
  it("resolves a mapped item id to its atlas frame", () => {
    expect(groundItemFrame("sword")).toBe("weapon_rusty_sword");
  });

  it("falls back to a generic frame for unmapped item ids", () => {
    expect(groundItemFrame("rag")).toBe("skull");
  });

  it("falls back to a generic frame when the defId is missing", () => {
    expect(groundItemFrame(undefined)).toBe("skull");
  });
});
