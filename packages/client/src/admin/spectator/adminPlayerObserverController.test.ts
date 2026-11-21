import { describe, expect, it } from "vitest";
import { AdminPlayerObserverController } from "./adminPlayerObserverController.js";

describe("admin player observer lifecycle", () => {
  it("does not render player or observer panels for the standalone editor layout", () => {
    const controller = new AdminPlayerObserverController(
      { adminPlayers: [], spectatorMode: "off", spectatorTargetId: null } as never,
      { players: undefined } as never,
    );

    expect(() => controller.render()).not.toThrow();
  });
});
