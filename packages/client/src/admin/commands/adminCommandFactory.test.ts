import { describe, expect, it } from "vitest";
import { commandForSpectatorToggle } from "./adminCommandFactory.js";

describe("admin spectator toggle", () => {
  it("starts in free-camera mode when switched on", () => {
    expect(commandForSpectatorToggle("off")).toEqual({
      op: "spectator",
      action: "start",
      mode: "free",
    });
  });

  it("switches either active camera mode off", () => {
    const stop = { op: "spectator", action: "stop" };
    expect(commandForSpectatorToggle("track")).toEqual(stop);
    expect(commandForSpectatorToggle("free")).toEqual(stop);
  });
});
