import { createBody, makeEntity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  nextObservedTarget,
  rememberedSearchDirection,
} from "../ai/search/enemySearchObservation.js";

describe("enemy search observation", () => {
  it("retains a target's last observed travel direction through a brief pause", () => {
    const target = makeEntity("player", createBody(2.5, 1.5, 0), {
      id: "moving-player",
      hp: 10,
      maxHp: 10,
    });
    const first = nextObservedTarget({
      previous: undefined,
      target,
      minimumMovementTiles: 0.05,
    });
    target.body.x += 0.5;
    const moving = nextObservedTarget({
      previous: first,
      target,
      minimumMovementTiles: 0.05,
    });
    const paused = nextObservedTarget({
      previous: moving,
      target,
      minimumMovementTiles: 0.05,
    });

    expect(rememberedSearchDirection(paused, target.id))
      .toEqual({ x: 1, y: 0 });
  });
});
