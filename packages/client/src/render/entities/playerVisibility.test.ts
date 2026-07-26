import { describe, expect, it } from "vitest";
import { shouldRenderLivePlayer } from "./playerVisibility.js";

describe("live player visibility", () => {
  it("hides dead player sprites for local and remote render paths", () => {
    expect(shouldRenderLivePlayer({ hp: 0 })).toBe(false);
    expect(shouldRenderLivePlayer({ hp: -1 })).toBe(false);
  });

  it("keeps living and downed players in live visual tracking", () => {
    expect(shouldRenderLivePlayer({ hp: 1 })).toBe(true);
  });
});
