import type { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import type { GameSim } from "../sim/index.js";
import { routeAuthenticatedMessage } from "./dispatch.js";
import type { SocketMap } from "./types.js";

describe("legacy respawn message dispatch", () => {
  it("ignores a legacy authenticated respawn message", () => {
    const queueAction = vi.fn();
    const sim = { queueAction } as unknown as GameSim;
    const sockets: SocketMap = new Map([
      ["dead-player", { sim, ws: {} as WebSocket }],
    ]);

    routeAuthenticatedMessage(
      { type: "respawn" },
      "dead-player",
      sockets,
    );

    expect(queueAction).not.toHaveBeenCalled();
  });
});
