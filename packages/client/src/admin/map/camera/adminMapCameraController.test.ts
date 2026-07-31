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
});
