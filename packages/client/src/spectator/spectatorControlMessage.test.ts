import { describe, expect, it } from "vitest";
import { spectatorControlMessage } from "./spectatorControlMessage.js";

const TYPE = "dc2d-spectator-control";

describe("spectator control message", () => {
  it("accepts valid action-specific messages", () => {
    expect(spectatorControlMessage({ type: TYPE, action: "zoom", direction: "in" }))
      .toEqual({ type: TYPE, action: "zoom", direction: "in" });
    expect(spectatorControlMessage({ type: TYPE, action: "mode", mode: "free" }))
      .toEqual({ type: TYPE, action: "mode", mode: "free" });
    expect(spectatorControlMessage({ type: TYPE, action: "zoom-reset" }))
      .toEqual({ type: TYPE, action: "zoom-reset" });
  });

  it.each([
    { type: TYPE, action: "zoom", direction: "sideways" },
    { type: TYPE, action: "mode", mode: "off" },
    { type: TYPE, action: "target", playerId: "" },
    { type: TYPE, action: "center", direction: "in" },
    { type: TYPE, action: "unknown" },
  ])("rejects malformed or non-strict input %#", (message) => {
    expect(spectatorControlMessage(message)).toBeNull();
  });
});
