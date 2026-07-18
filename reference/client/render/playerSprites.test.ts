import { describe, expect, it } from "vitest";
import {
  PLAYER_DIRECTIONS,
  PLAYER_FRAMES_PER_PALETTE,
  PLAYER_STATES,
  playerDirection,
  playerFrame,
} from "./playerSprites";

describe("player sprite contract", () => {
  it("assigns every state and direction a frame inside its palette", () => {
    for (const direction of PLAYER_DIRECTIONS) {
      for (const state of PLAYER_STATES) {
        const frame = playerFrame("self", direction, state, 0);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(PLAYER_FRAMES_PER_PALETTE);
        expect(playerFrame("peer", direction, state, 0)).toBe(frame + PLAYER_FRAMES_PER_PALETTE);
      }
    }
  });

  it("uses distinct walk frames and cardinal facing without rotating the image", () => {
    expect(playerFrame("self", "south", "walk", 0)).not.toBe(
      playerFrame("self", "south", "walk", 125),
    );
    expect(playerDirection(1, 0)).toBe("east");
    expect(playerDirection(-1, 0)).toBe("west");
    expect(playerDirection(0, -1)).toBe("north");
    expect(playerDirection(0, 1)).toBe("south");
  });
});

