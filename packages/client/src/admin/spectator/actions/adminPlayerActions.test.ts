import { describe, expect, it } from "vitest";
import { adminSpectatorActions } from "./adminPlayerActions.js";

describe("admin spectator actions", () => {
  it("uses one pressed switch action for both spectator states", () => {
    expect(adminSpectatorActions("off")[0]).toEqual([
      "Spectate",
      "spectator-toggle",
      false,
    ]);
    expect(adminSpectatorActions("track")[0]).toEqual([
      "Spectate",
      "spectator-toggle",
      true,
    ]);
  });

  it("retains camera mode controls and adds live zoom controls", () => {
    const actions = adminSpectatorActions("free");
    expect(actions).toContainEqual(["Free camera", "spectate", true]);
    expect(actions).toContainEqual(["−", "spectator-zoom-out"]);
    expect(actions).toContainEqual(["+", "spectator-zoom-in"]);
  });
});
