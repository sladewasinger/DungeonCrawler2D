import { TILE, type EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "../../../net/connection/connection.js";
import { createFrameEntityBuckets } from "./frameEntityBuckets.js";
import { resolveFrameInteractionPrompt } from "./frameInteractionPrompt.js";

const connection = (...snapshots: EntitySnapshot[]) => ({
  world: { worldSeed: 1, floor: 1, tileAt: () => TILE.Floor },
  body: { x: 5, y: 5, z: 0 },
  entities: new Map(snapshots.map((snapshot) => [snapshot.id, { snap: snapshot, samples: [] }])),
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

  it("uses only loot chests present in the filtered frame", () => {
    const hiddenChest: EntitySnapshot = {
      id: "hidden-loot",
      kind: "item",
      defId: "player-loot-chest",
      x: 5.1,
      y: 5,
      z: 0,
      lootOwnerName: "Hidden Crawler",
    };
    const buckets = createFrameEntityBuckets();

    expect(resolveFrameInteractionPrompt(connection(hiddenChest), buckets)).toBeNull();

    buckets.lootChests.push({
      id: "visible-loot",
      x: 5.2,
      y: 5,
      z: 0,
      snap: {
        ...hiddenChest,
        id: "visible-loot",
        lootOwnerName: "Visible Crawler",
      },
    });
    expect(resolveFrameInteractionPrompt(connection(hiddenChest), buckets))
      .toEqual({ key: "E", label: "open [DEAD] Visible Crawler's loot" });
  });
});
