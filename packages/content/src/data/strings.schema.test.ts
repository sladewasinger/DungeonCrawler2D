// Round-trip test: strings.json must validate against its own schema, and the
// schema must reject malformed data (Epic 7.13, book-fan lane).
import { describe, expect, it } from "vitest";
import strings from "./strings.json" with { type: "json" };
import { parseStrings, stringsSchema } from "./strings.schema.js";

describe("strings.json / stringsSchema", () => {
  it("parses the shipped strings.json unchanged", () => {
    const parsed = parseStrings(strings);
    expect(parsed).toEqual(strings);
  });

  it("rejects a record missing the premise field", () => {
    expect(() => stringsSchema.parse({ tagline: "only a tagline" })).toThrow();
  });

  it("rejects a non-string tagline", () => {
    expect(() => stringsSchema.parse({ premise: "p", tagline: 5 })).toThrow();
  });
});
