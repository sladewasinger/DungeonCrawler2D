import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance } from "./appearance.js";

describe("character appearance", () => {
  it("accepts valid customization values, defaults missing eyeColor, and falls back cleanly on invalid input", () => {
    const valid = { body: "slender", skin: "tan", eyeColor: "blue", hairStyle: "ponytail", hairColor: "red" };
    expect(sanitizeCharacterAppearance(valid)).toEqual(valid);
    expect(sanitizeCharacterAppearance({ body: "slender", skin: "tan", hairStyle: "ponytail", hairColor: "red" })).toEqual({
      body: "slender", skin: "tan", eyeColor: "brown", hairStyle: "ponytail", hairColor: "red",
    });
    expect(sanitizeCharacterAppearance({ body: "giant", skin: "blue" })).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeCharacterAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});
