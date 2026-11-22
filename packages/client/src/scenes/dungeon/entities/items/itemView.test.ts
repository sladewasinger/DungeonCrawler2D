import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { itemView } from "./itemView.js";

const CAMP_CHEST = "Bandit Camp Chest";

function entity(snap: Partial<EntitySnapshot> & { id: string; kind: EntitySnapshot["kind"] }) {
  const full: EntitySnapshot = { x: 0, y: 0, z: 0, ...snap };
  return { id: full.id, snap: full, x: full.x, y: full.y, z: full.z };
}

describe("world chest itemView", () => {
  it("renders world chests without [DEAD] prefix or unlock timer", () => {
    const view = itemView({
      e: entity({
        id: "wild",
        kind: "item",
        defId: "player-loot-chest",
        name: CAMP_CHEST,
        lootOwnerName: CAMP_CHEST,
      }),
    });
    expect(view).toMatchObject({
      lootLabel: CAMP_CHEST,
      lootIsWorldChest: true,
      lootNearby: false,
    });
    expect(view.lootLockSeconds).toBeUndefined();
  });
});
