// Thin glue between input/index.ts's InputController contracts and DungeonScene's real
// Connection + self cosmetics. Panels (craft/stash UI) aren't built yet (docs/PORT_PLAN.md
// core slice), so InputPanels is a harmless no-op here — the E/number-key bindings are
// already wired and become live the moment those widgets land.
import { TILE } from "@dc2d/engine";
import type { InputConnection, InputHooks, InputPanels, InputQueries } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import { isTileTypeNearby, isThrowableItem, nearestEntityId, recipeIdAtIndex } from "./contentQueries.js";
import { triggerSelfAttack, type SelfCosmeticsState } from "./selfCosmetics.js";

export function createInputConnectionAdapter(conn: Connection): InputConnection {
  return {
    get body() {
      return conn.body;
    },
    get canAct() {
      return conn.canAct;
    },
    get hotbar() {
      return conn.hotbar.map((id) => id ?? undefined);
    },
    get inventory() {
      return conn.inventory;
    },
    get stash() {
      return conn.stash;
    },
    get pendingInvite() {
      return conn.pendingInvite !== null;
    },
    interact: () => conn.interact(),
    pickup: () => conn.pickup(),
    attack: (dx, dy) => conn.attack(dx, dy),
    useSlot: (slot, targetX, targetY) => conn.useSlot(slot, targetX, targetY),
    craft: (recipeId) => conn.craft(recipeId),
    stashOp: (op, index) => conn.stashOp(op, index),
    partyOp: (op, target) => conn.partyOp(op, target),
  };
}

export function createInputPanels(): InputPanels {
  return {
    craftOpen: false,
    stashOpen: false,
    openStashIfNearby: () => {},
    toggleCraft: () => {},
    closeAll: () => {},
  };
}

function positionedEntities(conn: Connection): Array<{ id: string; kind: string; x: number; y: number }> {
  return [...conn.entities.entries()].map(([id, remote]) => ({
    id,
    kind: remote.snap.kind,
    x: remote.snap.x,
    y: remote.snap.y,
  }));
}

export function createInputQueries(conn: Connection): InputQueries {
  return {
    isThrowable: isThrowableItem,
    recipeIdAt: recipeIdAtIndex,
    nearestPlayerId: (adapter, maxDistance) =>
      adapter.body
        ? nearestEntityId(positionedEntities(conn), "player", adapter.body.x, adapter.body.y, maxDistance)
        : undefined,
    isStashNearby: (adapter) =>
      !!conn.world && !!adapter.body && isTileTypeNearby(conn.world, TILE.Stash, adapter.body.x, adapter.body.y),
    isCraftTableNearby: (adapter) =>
      !!conn.world &&
      !!adapter.body &&
      isTileTypeNearby(conn.world, TILE.CraftingTable, adapter.body.x, adapter.body.y),
  };
}

export function createInputHooks(cosmetics: SelfCosmeticsState, toggleChat: () => void): InputHooks {
  return {
    onSwing: (dx, dy) => triggerSelfAttack(cosmetics, performance.now(), dx, dy),
    // Chunk-grid debug overlay isn't built in this wave — GalleryScene's coordinate
    // readout (render/terrain debugging) covers it for now.
    onToggleBorders: () => {},
    onToggleChat: toggleChat,
  };
}
