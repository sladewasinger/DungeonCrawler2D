import { describe, expect, it } from "vitest";
import { staminaBarView } from "./staminaBar.js";

describe("staminaBarView", () => {
  it("clamps fill and exposes the authoritative amount", () => {
    expect(staminaBarView(42, 100, false)).toMatchObject({
      ratio: 0.42,
      label: "STAMINA 42 / 100",
    });
    expect(staminaBarView(120, 100, false).ratio).toBe(1);
  });

  it("makes active blocking explicit", () => {
    expect(staminaBarView(17.2, 100, true).label).toBe("BLOCKING · 18");
  });
});
