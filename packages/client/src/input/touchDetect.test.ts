// Headless tests for touch-capability detection and the ?touch=1 override.
import { describe, expect, it } from "vitest";
import { isTouchDevice } from "./touchDetect.js";

function fakeWindow(overrides: { search?: string; ontouchstart?: boolean; maxTouchPoints?: number }): Window {
  const search = overrides.search ?? "";
  const win: Partial<Window> & { navigator: Partial<Navigator> } = {
    location: { search } as Location,
    navigator: { maxTouchPoints: overrides.maxTouchPoints ?? 0 } as Navigator,
  };
  if (overrides.ontouchstart) (win as unknown as Record<string, unknown>).ontouchstart = null;
  return win as Window;
}

describe("isTouchDevice", () => {
  it("is false on a plain desktop window", () => {
    expect(isTouchDevice(fakeWindow({}))).toBe(false);
  });

  it("is true when the browser reports ontouchstart support", () => {
    expect(isTouchDevice(fakeWindow({ ontouchstart: true }))).toBe(true);
  });

  it("is true when navigator.maxTouchPoints is positive", () => {
    expect(isTouchDevice(fakeWindow({ maxTouchPoints: 5 }))).toBe(true);
  });

  it("is true under the ?touch=1 override even with no touch capability", () => {
    expect(isTouchDevice(fakeWindow({ search: "?touch=1" }))).toBe(true);
  });

  it("ignores any other ?touch value", () => {
    expect(isTouchDevice(fakeWindow({ search: "?touch=0" }))).toBe(false);
  });
});
