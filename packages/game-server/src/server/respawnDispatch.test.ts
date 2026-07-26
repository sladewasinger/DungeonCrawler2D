import type { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import type { GameSim } from "../sim/index.js";
import { routeAuthenticatedMessage } from "./dispatch.js";
import type { SocketMap } from "./types.js";

describe("respawn message dispatch", () => {
  it("routes an authenticated respawn directly to its authoritative sim", () => {
    const requestImmediateRespawn = vi.fn();
    const sim = { requestImmediateRespawn } as unknown as GameSim;
    const sockets: SocketMap = new Map([
      ["dead-player", { sim, ws: {} as WebSocket }],
    ]);

    routeAuthenticatedMessage(
      { type: "respawn" },
      "dead-player",
      sockets,
    );

    expect(requestImmediateRespawn).toHaveBeenCalledOnce();
    expect(requestImmediateRespawn).toHaveBeenCalledWith("dead-player");
  });
});
