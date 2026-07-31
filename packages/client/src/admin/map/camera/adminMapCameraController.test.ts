import { describe, expect, it, vi } from "vitest";
import type { Connection } from "../../../net/connection/connection.js";
import type { AdminSpectatorSurface } from "../../adminSpectatorSurface.js";
import type { AdminPageView } from "../../adminPageView.js";
import { AdminMapCameraController } from "./adminMapCameraController.js";

describe("admin map camera controls", () => {
  it("focuses the map immediately when free pan is selected", () => {
    const focusInput = vi.fn();
    const controller = new AdminMapCameraController({
      connection: { adminAuthenticated: true } as Connection,
      view: {} as AdminPageView,
      surface: { focusInput } as unknown as AdminSpectatorSurface,
    });

    controller.freeCamera();

    expect(focusInput).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it("requests bounded map coverage only when the zoomed viewport needs it", () => {
    const sendAdminCommand = vi.fn();
    const connection = {
      adminAuthenticated: true,
      adminMap: { level: "dungeon", floor: 1, radius: 18 },
      sendAdminCommand,
    } as unknown as Connection;
    const view = {
      mapLevel: { value: "dungeon" },
      mapFloor: { value: "1" },
    } as AdminPageView;
    const surface = {
      center: { x: 0.5, y: 0.5 },
      requiredMapRadius: 24,
    } as unknown as AdminSpectatorSurface;
    const controller = new AdminMapCameraController({ connection, view, surface });

    controller.ensureViewportCoverage();
    expect(sendAdminCommand).toHaveBeenCalledWith(expect.objectContaining({
      op: "map",
      radius: 24,
    }));

    connection.adminMap = { level: "dungeon", floor: 1, radius: 24 } as typeof connection.adminMap;
    controller.ensureViewportCoverage();
    expect(sendAdminCommand).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("requests the Combat Sandbox as a distinct inspectable world", () => {
    const sendAdminCommand = vi.fn();
    const connection = { adminAuthenticated: true, sendAdminCommand } as unknown as Connection;
    const view = {
      mapLevel: { value: "combat-sandbox" },
      mapFloor: { value: "1" },
    } as AdminPageView;
    const surface = { requiredMapRadius: 12 } as unknown as AdminSpectatorSurface;
    const controller = new AdminMapCameraController({ connection, view, surface });

    controller.panTo({ x: 25.5, y: 25.5 });

    expect(sendAdminCommand).toHaveBeenCalledWith(expect.objectContaining({
      op: "map",
      level: "combat-sandbox",
    }));
    controller.dispose();
  });
});
