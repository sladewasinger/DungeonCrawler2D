import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance } from "./appearance.js";

describe("character appearance", () => {
  it("accepts valid customization values and falls back cleanly on invalid input", () => {
    const valid = { body: "slender", skin: "tan", hairStyle: "ponytail", hairColor: "red" };
    expect(sanitizeCharacterAppearance(valid)).toEqual(valid);
    expect(sanitizeCharacterAppearance({ body: "giant", skin: "blue" })).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeCharacterAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});
