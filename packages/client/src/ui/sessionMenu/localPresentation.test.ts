/** Covers persistence-input validation for local-only accessibility preferences. */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCAL_PRESENTATION,
  MAX_BRIGHTNESS,
  MAX_FONT_SCALE,
  MIN_BRIGHTNESS,
  MIN_FONT_SCALE,
  parseLocalPresentation,
} from "./localPresentation.js";

describe("local presentation preferences", () => {
  it("falls back for missing, corrupt, or future schemas", () => {
    expect(parseLocalPresentation(null)).toEqual(DEFAULT_LOCAL_PRESENTATION);
    expect(parseLocalPresentation({ schemaVersion: 2, brightness: 1.2 })).toEqual(
      DEFAULT_LOCAL_PRESENTATION,
    );
    expect(parseLocalPresentation({
      schemaVersion: 1,
      brightness: Number.NaN,
      fontScale: "large",
    })).toEqual(DEFAULT_LOCAL_PRESENTATION);
  });

  it("clamps persisted values to the supported accessibility range", () => {
    expect(parseLocalPresentation({
      schemaVersion: 1,
      brightness: 99,
      fontScale: -2,
    })).toEqual({
      schemaVersion: 1,
      brightness: MAX_BRIGHTNESS,
      fontScale: MIN_FONT_SCALE,
    });
    expect(parseLocalPresentation({
      schemaVersion: 1,
      brightness: -99,
      fontScale: 99,
    })).toEqual({
      schemaVersion: 1,
      brightness: MIN_BRIGHTNESS,
      fontScale: MAX_FONT_SCALE,
    });
  });
});
