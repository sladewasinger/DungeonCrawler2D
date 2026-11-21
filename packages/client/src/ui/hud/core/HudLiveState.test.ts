import { TILE, type EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "../../../net/connection/connection.js";
import { staticTileWorldFixture } from "../../../testing/terrainWorldFixture.js";
import { buildHudLiveState } from "./HudLiveState.js";

const world = (station = false) => staticTileWorldFixture(
  station ? TILE.CraftingTable : TILE.Floor,
);

const connection = (
  withItem = false,
  hotbar: readonly (string | null)[] = [],
  weapon: string | null = null,
) => ({
  body: { x: 20.2, y: 20.2 },
  inventory: [{ item: "rag", qty: 2 }],
  stash: [{ item: "stick", qty: 1 }],
  hotbar,
  weapon,
  canBlock: weapon !== null,
  entities: new Map(withItem
    ? [["item", { snap: { id: "item", kind: "item", x: 20.4, y: 20.2 } as EntitySnapshot }]]
    : []),
  party: null,
  status: "connected",
  reconnectAttempts: 0,
  toasts: [],
  contacts: [{ name: "Wren", online: true }],
}) as unknown as Connection;

describe("buildHudLiveState", () => {
  it("feeds live station and contact data to first-person utility panels", () => {
    const state = buildHudLiveState(connection(), world(true), -1);
    expect(state.craft.nearby).toBe(true);
    expect(state.craft.recipes.length).toBeGreaterThan(0);
    expect(state.stash.inventory[0]?.name).toBe("Rag");
    expect(state.contacts).toEqual([{ name: "Wren", online: true }]);
  });

  it("maps nearby pickup prompts to the first-person E/USE action", () => {
    const state = buildHudLiveState(connection(true), world(), -1);
    expect(state.notices.interactionPrompt).toEqual({ key: "E", label: "pick up" });
  });

  it("feeds selected-item and weapon actions through the live notice model", () => {
    const state = buildHudLiveState(
      connection(false, ["bandage"], "sword"),
      world(),
      0,
    );
    expect(state.notices.actionHints.map(({ action }) => action))
      .toEqual(["use", "attack", "block"]);
  });
});
