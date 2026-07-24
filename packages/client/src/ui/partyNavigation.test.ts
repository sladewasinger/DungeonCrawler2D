/** Verifies labeled party directions in both north-up and rotated views. */
import { describe, expect, it } from "vitest";
import { resolvePartyNavigation } from "./partyNavigation.js";

describe("resolvePartyNavigation", () => {
  it("maps world directions to readable arrows and rounded tile distance", () => {
    expect(resolvePartyNavigation({ x: 0, y: 0 }, { x: 0, y: -4.4 }, 0)).toEqual({
      arrow: "↑",
      distance: 4,
    });
    expect(resolvePartyNavigation({ x: 0, y: 0 }, { x: 3, y: 0 }, 0).arrow).toBe("→");
  });

  it("keeps the arrow relative to a rotated camera", () => {
    expect(resolvePartyNavigation({ x: 0, y: 0 }, { x: 3, y: 0 }, 90).arrow).toBe("↓");
    expect(resolvePartyNavigation({ x: 0, y: 0 }, { x: 0, y: 3 }, -180).arrow).toBe("↑");
  });
});
