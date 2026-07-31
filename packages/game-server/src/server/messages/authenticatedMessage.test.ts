import type { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import type { GameSim } from "../../sim/core/index.js";
import { routeAuthenticatedMessage } from "./authenticatedMessage.js";
import type { SocketMap } from "../types.js";

describe("authenticated network profile routing", () => {
  it("changes snapshot cadence without queuing a gameplay action", () => {
    const configureNetworkProfile = vi.fn();
    const queueAction = vi.fn();
    const sim = { configureNetworkProfile, queueAction } as unknown as GameSim;
    const sockets: SocketMap = new Map([["player", { sim, ws: {} as WebSocket }]]);

    routeAuthenticatedMessage(
      { type: "networkProfile", profile: "corpnet" },
      "player",
      sockets,
    );
    routeAuthenticatedMessage(
      { type: "networkProfile", profile: null },
      "player",
      sockets,
    );

    expect(configureNetworkProfile).toHaveBeenNthCalledWith(1, "player", "corpnet");
    expect(configureNetworkProfile).toHaveBeenNthCalledWith(2, "player", null);
    expect(queueAction).not.toHaveBeenCalled();
  });

  it("reports whether gameplay input or actions were accepted", () => {
    const handleInput = vi.fn().mockReturnValue(false);
    const queueAction = vi.fn().mockReturnValue(true);
    const sim = { handleInput, queueAction } as unknown as GameSim;
    const sockets: SocketMap = new Map([["player", { sim, ws: {} as WebSocket }]]);

    const rejectedInput = routeAuthenticatedMessage({
      type: "input",
      seq: 1,
      projectedServerTick: 1,
      moveX: 1,
      moveY: 0,
      jump: false,
      run: false,
    }, "player", sockets);
    const acceptedAction = routeAuthenticatedMessage(
      { type: "attack", dirX: 1, dirY: 0 },
      "player",
      sockets,
    );

    expect(rejectedInput).toBe(false);
    expect(acceptedAction).toBe(true);
  });
});
