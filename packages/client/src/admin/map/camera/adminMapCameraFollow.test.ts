import { describe, expect, it, vi } from "vitest";
import type { AdminPlayer } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type { AdminSpectatorSurface } from "../../adminSpectatorSurface.js";
import type { AdminPageView } from "../../portal/adminPageView.js";
import { AdminMapCameraController } from "./adminMapCameraController.js";

describe("admin map spectator follow", () => {
  it("refreshes the followed player while free camera is off", () => {
    const first = { playerId: "player-1", level: "dungeon", floor: 1, x: 4.2, y: 6.8 } as AdminPlayer;
    const moved = { ...first, x: 18.2, y: 21.8 };
    const focus = vi.fn();
    const connection = {
      adminAuthenticated: true, adminPlayers: [first], sendAdminCommand: vi.fn(),
    } as unknown as Connection;
    const controller = new AdminMapCameraController({
      connection,
      view: { mapLevel: { value: "dungeon" }, mapFloor: { value: "1" } } as AdminPageView,
      surface: { focus, requiredMapRadius: 12 } as unknown as AdminSpectatorSurface,
    });

    controller.followPlayer(first);
    connection.adminPlayers = [moved];
    controller.refreshFollow();

    expect(focus).toHaveBeenLastCalledWith({ x: 18.5, y: 21.5 });
    controller.dispose();
  });
});
