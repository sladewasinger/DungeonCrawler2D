import { describe, expect, it } from "vitest";
import { parseFistbumpSealPartner } from "./fistbumpSeal.js";

describe("parseFistbumpSealPartner", () => {
  it("extracts the partner name from the exact server-authored seal line", () => {
    expect(parseFistbumpSealPartner("system", "You and Wren are now contacts!")).toBe("Wren");
  });

  it("handles display names containing spaces", () => {
    expect(parseFistbumpSealPartner("system", "You and Sir Wren III are now contacts!")).toBe("Sir Wren III");
  });

  it("ignores non-system channels even with matching text", () => {
    expect(parseFistbumpSealPartner("local", "You and Wren are now contacts!")).toBeNull();
  });

  it("ignores unrelated system lines, including near-miss fistbump text", () => {
    expect(parseFistbumpSealPartner("system", "Wren offers a fistbump — hold F back to seal it")).toBeNull();
    expect(parseFistbumpSealPartner("system", "You offer Wren a fistbump.")).toBeNull();
    expect(parseFistbumpSealPartner("system", "Unknown command /x — try /help")).toBeNull();
  });
});
