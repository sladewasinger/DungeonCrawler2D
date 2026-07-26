import { TILE, type WorldInteractionTarget } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { bandageNearbyPlayer, interactOrUse } from "./gameplayActions.js";
import type { InputConnection, InputPanels, InputQueries } from "./state.js";

const target = (kind: WorldInteractionTarget["kind"]): WorldInteractionTarget => ({
  kind,
  tile: kind === "door" ? TILE.DoorExit : kind === "stash" ? TILE.Stash : TILE.CraftingTable,
  x: 0,
  y: 0,
});

const setup = (
  interaction: WorldInteractionTarget | null,
  options: {
    stair?: boolean;
    revive?: boolean;
    consumable?: boolean;
    nearby?: string;
    lootCanOpen?: boolean;
  } = {},
) => {
  const calls: string[] = [];
  const conn = {
    body: { x: 0, y: 0 },
    canAct: true,
    downed: false,
    dead: false,
    hotbar: [options.consumable ? "bandage" : undefined],
    inventory: options.consumable ? [{ item: "bandage", qty: 1 }] : [],
    stash: null,
    pendingInvite: false,
    weapon: null,
    interact: () => calls.push("interact"),
    revive: () => calls.push("revive"),
    pickup: () => calls.push("pickup"),
    attack: () => calls.push("attack"),
    useSlot: () => calls.push("useSlot"),
    useSlotOnPlayer: (_slot, id) => calls.push(`bandage:${id}`),
    useItem: () => calls.push("useItem"),
    throwTorch: () => calls.push("throwTorch"),
    craft: () => calls.push("craft"),
    stashOp: () => calls.push("stashOp"),
    lootChestOp: (id, op) => calls.push(`lootChest:${id}:${op}`),
    partyOp: () => calls.push("partyOp"),
    assignSlot: () => calls.push("assignSlot"),
    equip: () => calls.push("equip"),
    drop: () => calls.push("drop"),
    fistbump: () => calls.push("fistbump"),
    descend: () => calls.push("descend"),
    suicide: () => calls.push("suicide"),
    pushToast: () => calls.push("toast"),
  } satisfies InputConnection;
  const panels = {
    craftOpen: false,
    stashOpen: false,
    inventoryOpen: false,
    gameplayBlocked: false,
    selectedInventoryItem: null,
    toggleStash: () => {
      calls.push("toggleStash");
      return true;
    },
    toggleCraft: () => calls.push("toggleCraft"),
    closeAll: () => calls.push("closeAll"),
  } satisfies InputPanels;
  const queries = {
    isThrowable: () => false,
    isConsumable: () => Boolean(options.consumable),
    attackCooldownMs: () => 0,
    recipeIdAt: () => undefined,
    nearestPlayerId: () => options.nearby,
    nearbyLootChest: () => options.lootCanOpen === undefined
      ? undefined
      : { id: "loot-1", canOpen: options.lootCanOpen },
    isStashNearby: () => interaction?.kind === "stash",
    isCraftTableNearby: () => interaction?.kind === "craft",
    worldInteraction: () => interaction,
    isStairwayNearby: () => Boolean(options.stair),
    downedPartyMemberInRange: () => options.revive ? { id: "ally" } : undefined,
  } satisfies InputQueries;
  return { calls, conn, panels, queries };
};

describe("loot chest interaction priority", () => {
  it("opens an eligible chest and still lets the server validate it", () => {
    const { calls, conn, panels, queries } = setup(null, { lootCanOpen: true });
    interactOrUse(conn, panels, queries, null, () => false);
    expect(calls).toEqual(["lootChest:loot-1:open", "toggleStash"]);
  });

  it("uses a fresh prompt target on the first interaction call", () => {
    const state = setup(null);
    let prompted = false;
    state.queries.nearbyLootChest = () => {
      prompted = true;
      return { id: "loot-first", canOpen: true };
    };

    interactOrUse(state.conn, state.panels, state.queries, null, () => false);

    expect(prompted).toBe(true);
    expect(state.calls).toEqual(["lootChest:loot-first:open", "toggleStash"]);
  });

  it("asks the server for lock feedback without opening for a stranger", () => {
    const { calls, conn, panels, queries } = setup(null, { lootCanOpen: false });
    interactOrUse(conn, panels, queries, null, () => false);
    expect(calls).toEqual(["lootChest:loot-1:open"]);
  });
});

describe("interactOrUse", () => {
  it("keeps stair and revive ahead of world and selected-item actions", () => {
    const stair = setup(target("door"), { stair: true, consumable: true });
    interactOrUse(stair.conn, stair.panels, stair.queries, 0, () => false);
    expect(stair.calls).toEqual(["descend"]);

    const revive = setup(target("door"), { revive: true, consumable: true });
    interactOrUse(revive.conn, revive.panels, revive.queries, 0, (id) => {
      revive.calls.push(`revive:${id}`);
      return true;
    });
    expect(revive.calls).toEqual(["revive:ally"]);
  });

  it("maps each world target to exactly one matching panel or server intent", () => {
    for (const [kind, expected] of [
      ["door", ["interact"]],
      ["stash", ["toggleStash", "interact"]],
      ["craft", ["toggleCraft"]],
    ] as const) {
      const state = setup(target(kind));
      interactOrUse(state.conn, state.panels, state.queries, null, () => false);
      expect(state.calls).toEqual(expected);
    }
  });

  it("uses a selected consumable only when no higher-priority context exists", () => {
    const state = setup(null, { consumable: true });
    interactOrUse(state.conn, state.panels, state.queries, 0, () => false);
    expect(state.calls).toEqual(["useSlot"]);
  });

  it("uses pickup as the touch fallback without false failure feedback", () => {
    const state = setup(null);
    interactOrUse(state.conn, state.panels, state.queries, null, () => false, "pickup");
    expect(state.calls).toEqual(["pickup"]);
  });

  it("applies a selected owned bandage to the nearest player", () => {
    const state = setup(null, { consumable: true, nearby: "ally" });

    expect(bandageNearbyPlayer(state.conn, state.queries, 0)).toBe(true);
    expect(state.calls).toEqual(["bandage:ally"]);
  });

  it("leaves F available when no nearby bandage target exists", () => {
    const state = setup(null, { consumable: true });

    expect(bandageNearbyPlayer(state.conn, state.queries, 0)).toBe(false);
    expect(state.calls).toEqual([]);
  });
});
