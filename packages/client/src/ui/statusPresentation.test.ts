/** Verifies both HUD renderers receive the same authoritative status progress. */
import { describe, expect, it } from "vitest";
import { statusPresentations } from "./statusPresentation.js";

describe("status presentation", () => {
  it("preserves authoritative bandage progress and content semantics", () => {
    expect(statusPresentations([{
      id: "bandaged",
      remainingSeconds: 3.25,
      durationSeconds: 5,
    }], ["bandaged"])).toEqual([{
      id: "bandaged",
      kind: "buff",
      remainingSeconds: 3.25,
      durationSeconds: 5,
    }]);
  });
});
