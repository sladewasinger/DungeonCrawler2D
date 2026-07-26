import { TILE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "../../net/connection.js";
import { createFrameEntityBuckets } from "./frameEntityBuckets.js";
import { resolveFrameInteractionPrompt } from "./frameInteractionPrompt.js";

const connection = () => ({
  world: { worldSeed: 1, floor: 1, tileAt: () => TILE.Floor },
  body: { x: 5, y: 5 },
  entities: new Map(),
}) as unknown as Connection;

describe("frame interaction prompt", () => {
  it("uses the current frame buckets without relying on outer scope", () => {
    const buckets = createFrameEntityBuckets();
    buckets.pickupTargets.push({
      id: "rag",
      x: 5.2,
      y: 5,
      z: 0,
      snap: { id: "rag", kind: "item", x: 5.2, y: 5, z: 0 },
    });

    expect(resolveFrameInteractionPrompt(connection(), buckets))
      .toEqual({ key: "R", label: "pick up" });
  });

  it("prompts for the nearest unrelated downed player", () => {
    const buckets = createFrameEntityBuckets();
    buckets.players.push({
      id: "stranger",
      x: 5.5,
      y: 5,
      z: 0,
      snap: { id: "stranger", kind: "player", x: 5.5, y: 5, z: 0, downed: true },
    });

    expect(resolveFrameInteractionPrompt(connection(), buckets))
      .toEqual({ key: "E", label: "hold to revive" });
  });
});
