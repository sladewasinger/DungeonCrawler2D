import { describe, expect, it } from "vitest";
import {
  ACTOR_VISUAL_SCREEN_OFFSET_Y_PX,
  actorScreenAnchor,
} from "./actorScreenAnchor.js";

describe("actorScreenAnchor", () => {
  it("moves actor visuals down from their height-projected position", () => {
    expect(actorScreenAnchor({
      screen: { x: 120, y: 240 },
      liftPx: 16,
    })).toEqual({
      x: 120,
      y: 240 - 16 + ACTOR_VISUAL_SCREEN_OFFSET_Y_PX,
    });
  });

  it("preserves asset-specific baseline adjustment before the shared offset", () => {
    expect(actorScreenAnchor({
      screen: { x: 0, y: 100 },
      liftPx: 8,
      baselineOffsetPx: 2,
    }).y).toBe(100 - 8 + 2 + ACTOR_VISUAL_SCREEN_OFFSET_Y_PX);
  });
});
