/** Locks health-event sign, label, and palette semantics shared by both renderers. */
import { describe, expect, it } from "vitest";
import { healthFeedback } from "./healthFeedback.js";

describe("health feedback", () => {
  it("renders authoritative healing as green positive feedback", () => {
    expect(healthFeedback(4, "heal")).toEqual({
      kind: "heal",
      delta: 4,
      label: "+4",
      color: "#58d68d",
    });
  });

  it("keeps damage red and negative", () => {
    expect(healthFeedback(-7, "damage")).toEqual({
      kind: "damage",
      delta: -7,
      label: "-7",
      color: "#e04a4a",
    });
  });
});
