import { createDebugFlags, type DebugFlags } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import {
  adminDebugControlsEnabled,
  publishAdminDebugFlags,
} from "./AdminDebugPanel.js";

describe("admin debug HUD controls", () => {
  it("allows controls only for active admins outside HUD edit mode", () => {
    expect(adminDebugControlsEnabled(true, false)).toBe(true);
    expect(adminDebugControlsEnabled(true, true)).toBe(false);
    expect(adminDebugControlsEnabled(false, false)).toBe(false);
  });

  it("holds a requested checkbox state until a server snapshot acknowledges it", () => {
    const sendAdminCommand = vi.fn();
    const connection = {
      activeAdminDebugFlags: createDebugFlags(),
      sendAdminCommand,
    };
    const flags: DebugFlags = { ...createDebugFlags(), hurtboxes: true };

    publishAdminDebugFlags(connection, flags);

    expect(connection.activeAdminDebugFlags).toEqual(flags);
    expect(sendAdminCommand).toHaveBeenCalledWith({ op: "debug", flags });
  });
});
