import { afterEach, describe, expect, it } from "vitest";
import { getViewOrientation, resetViewOrientation, setViewOrientation } from "./viewState.js";

afterEach(() => resetViewOrientation());

describe("viewState", () => {
  it("defaults to orientation 0", () => {
    expect(getViewOrientation()).toBe(0);
  });

  it("setViewOrientation updates what getViewOrientation returns", () => {
    setViewOrientation(90);
    expect(getViewOrientation()).toBe(90);
  });

  it("normalizes non-canonical inputs (e.g. a stray -90 from a query param)", () => {
    setViewOrientation(-90);
    expect(getViewOrientation()).toBe(270);
  });

  it("resetViewOrientation restores the default", () => {
    setViewOrientation(180);
    resetViewOrientation();
    expect(getViewOrientation()).toBe(0);
  });
});
