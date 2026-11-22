import { describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance } from "./appearance.js";

describe("character appearance", () => {
  it("accepts valid customization values, migrates legacy body styles, defaults missing eyeColor, and falls back cleanly", () => {
    const valid = { body: "female", skin: "tan", eyeColor: "blue", hairStyle: "ponytail", hairColor: "red" };
    expect(sanitizeCharacterAppearance(valid)).toEqual(valid);
    expect(sanitizeCharacterAppearance({ body: "classic", skin: "tan", hairStyle: "ponytail", hairColor: "red" })).toEqual({
      body: "male", skin: "tan", eyeColor: "brown", hairStyle: "ponytail", hairColor: "red",
    });
    expect(sanitizeCharacterAppearance({ body: "slender", skin: "tan", eyeColor: "violet", hairStyle: "ponytail", hairColor: "red" })).toEqual({
      body: "female", skin: "tan", eyeColor: "violet", hairStyle: "ponytail", hairColor: "red",
    });
    expect(sanitizeCharacterAppearance({ body: "giant", skin: "blue" })).toEqual(DEFAULT_APPEARANCE);
    expect(sanitizeCharacterAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });
});
