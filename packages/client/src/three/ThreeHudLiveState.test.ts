import { TILE, type EntitySnapshot, type World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { Connection } from "../net/connection.js";
import { buildThreeHudLiveState } from "./ThreeHudLiveState.js";

const world = (station = false) => ({
  worldSeed: 228182761,
  floor: 1,
  tileAt: (x: number, y: number) =>
    station && x === 20 && y === 20 ? TILE.CraftingTable : TILE.Floor,
}) as World;

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

describe("buildThreeHudLiveState", () => {
  it("feeds live station and contact data to first-person utility panels", () => {
    const state = buildThreeHudLiveState(connection(), world(true), -1);
    expect(state.craft.nearby).toBe(true);
    expect(state.craft.recipes.length).toBeGreaterThan(0);
    expect(state.stash.inventory[0]?.name).toBe("Rag");
    expect(state.contacts).toEqual([{ name: "Wren", online: true }]);
  });

  it("maps nearby pickup prompts to the first-person E/USE action", () => {
    const state = buildThreeHudLiveState(connection(true), world(), -1);
    expect(state.notices.interactionPrompt).toEqual({ key: "E", label: "pick up" });
  });

  it("feeds selected-item and weapon actions through the live notice model", () => {
    const state = buildThreeHudLiveState(
      connection(false, ["bandage"], "sword"),
      world(),
      0,
    );
    expect(state.notices.actionHints.map(({ action }) => action))
      .toEqual(["use", "attack", "block"]);
  });
});
