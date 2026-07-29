import { describe, expect, it } from "vitest";
import { groundItemFrame } from "./itemFrame.js";

describe("groundItemFrame", () => {
  it("resolves a mapped item id to its atlas frame", () => {
    expect(groundItemFrame("sword")).toBe("weapon_rusty_sword");
  });

  it("uses distinct atlas frames for common materials and consumables", () => {
    expect(groundItemFrame("rag")).toBe("item_rag");
    expect(groundItemFrame("bandage")).toBe("item_bandage");
    expect(groundItemFrame("torch")).toBe("item_torch");
  });

  it("falls back to a generic frame when the defId is missing", () => {
    expect(groundItemFrame(undefined)).toBe("skull");
  });
});
