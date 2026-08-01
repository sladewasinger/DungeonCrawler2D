import { describe, expect, it, vi } from "vitest";
import type { AdminPlayer } from "@dc2d/engine";
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

  it("restores the prior followed player when free pan is toggled off", () => {
    const focusInput = vi.fn();
    const focus = vi.fn();
    const player = {
      playerId: "player-1",
      level: "dungeon",
      floor: 2,
      x: 4.2,
      y: 6.8,
    } as AdminPlayer;
    const connection = {
      adminAuthenticated: true,
      adminPlayers: [player],
      adminMap: { floor: 2, radius: 18 },
      sendAdminCommand: vi.fn(),
    } as unknown as Connection;
    const surface = {
      focusInput,
      focus,
      requiredMapRadius: 12,
    } as unknown as AdminSpectatorSurface;
    const controller = new AdminMapCameraController({
      connection,
      view: { mapLevel: { value: "dungeon" }, mapFloor: { value: "1" } } as AdminPageView,
      surface,
    });

    controller.followPlayer(player);
    controller.freeCamera();
    controller.restoreCamera();

    expect(focusInput).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenLastCalledWith({ x: 4.5, y: 6.5 });
    controller.dispose();
  });

  it("synchronizes the toggle when player selection exits free pan", () => {
    const onFreePanStateChange = vi.fn();
    const player = {
      playerId: "player-1",
      level: "dungeon",
      floor: 1,
      x: 4,
      y: 6,
    } as AdminPlayer;
    const controller = new AdminMapCameraController({
      connection: {
        adminAuthenticated: true,
        adminPlayers: [player],
        sendAdminCommand: vi.fn(),
      } as unknown as Connection,
      view: { mapLevel: { value: "dungeon" }, mapFloor: { value: "1" } } as AdminPageView,
      surface: { focusInput: vi.fn(), focus: vi.fn(), requiredMapRadius: 12 } as unknown as AdminSpectatorSurface,
      onFreePanStateChange,
    });

    controller.freeCamera();
    controller.followPlayer(player);

    expect(onFreePanStateChange).toHaveBeenNthCalledWith(1, true);
    expect(onFreePanStateChange).toHaveBeenNthCalledWith(2, false);
    controller.dispose();
  });

  it("resets free pan and publishes OFF after auth loss", () => {
    const onFreePanStateChange = vi.fn();
    const controller = new AdminMapCameraController({
      connection: {
        adminAuthenticated: true,
        adminPlayers: [],
        sendAdminCommand: vi.fn(),
      } as unknown as Connection,
      view: {} as AdminPageView,
      surface: { focusInput: vi.fn() } as unknown as AdminSpectatorSurface,
      onFreePanStateChange,
    });

    controller.freeCamera();
    controller.resetFreePan();
    controller.restoreCamera();

    expect(onFreePanStateChange).toHaveBeenNthCalledWith(1, true);
    expect(onFreePanStateChange).toHaveBeenNthCalledWith(2, false);
    expect(onFreePanStateChange).toHaveBeenCalledTimes(2);
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
