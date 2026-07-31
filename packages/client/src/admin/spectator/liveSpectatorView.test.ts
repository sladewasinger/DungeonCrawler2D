import { describe, expect, it } from "vitest";
import type { AdminMap } from "@dc2d/engine";
import { createLiveSpectatorView, liveSpectatorPoint } from "./liveSpectatorView.js";

describe("live spectator camera", () => {
  it("centers the selected player and applies the player's elevation", () => {
    const map = spectatorMap();
    const view = createLiveSpectatorView({
      map,
      targetId: "player-1",
      canvas: { width: 504, height: 504 },
    });

    expect(view.center).toEqual({ x: 12.5, y: 8.5 });
    expect(liveSpectatorPoint(view, { x: 12.5, y: 8.5 }, 2)).toEqual(view.focus);
    expect(liveSpectatorPoint(view, { x: 12.5, y: 9.5 }, 3).y).toBe(view.focus.y);
  });
});

function spectatorMap(): AdminMap {
  return {
    level: "dungeon",
    floor: 1,
    center: { x: 0, y: 0 },
    radius: 10,
    cells: [],
    entities: [{
      id: "player-1",
      kind: "player",
      name: "Austin",
      x: 12.5,
      y: 8.5,
      z: 2,
    }],
  };
}
