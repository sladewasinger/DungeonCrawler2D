import { describe, expect, it } from "vitest";
import { adminAuthenticationStatus } from "./adminAuthenticationStatus.js";

describe("admin authentication status", () => {
  it("explains that a server restart expires the saved continuation session", () => {
    expect(adminAuthenticationStatus({
      ok: false,
      reason: "expired",
      capabilities: [],
    })).toContain("game server restarted");
  });

  it("shows successful capabilities", () => {
    expect(adminAuthenticationStatus({
      ok: true,
      capabilities: ["players:read", "spectator:use"],
    })).toBe("Authenticated · players:read, spectator:use");
  });
});
