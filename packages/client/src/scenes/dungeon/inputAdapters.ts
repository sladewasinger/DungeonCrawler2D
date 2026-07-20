// Thin glue between input/index.ts's InputController contracts and DungeonScene's real
// Connection + self cosmetics. Inventory (HUD_OS.md Phase 1) and craft/stash (Epic 7.12,
// panelAdapters.ts) are both real: InputPanels reads every field live from HudScene.
import { INTERACT_RANGE, TILE } from "@dc2d/engine";
import type { InputConnection, InputHooks, InputQueries } from "../../input/index.js";
import type { Connection } from "../../net/connection.js";
import type { InventoryActions } from "../../ui/widgets/hud/inventoryWindow.js";
import { isDoorTileAt, isTileTypeNearby, isThrowableItem, nearestDownedPartyMember, nearestEntityId, recipeIdAtIndex } from "./contentQueries.js";
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
    get weapon() {
      return conn.weapon;
    },
    interact: () => conn.interact(),
    pickup: () => conn.pickup(),
    attack: (dx, dy) => conn.attack(dx, dy),
    useSlot: (slot, targetX, targetY) => conn.useSlot(slot, targetX, targetY),
    throwTorch: (dirX, dirY) => conn.throwTorch(dirX, dirY),
    craft: (recipeId) => conn.craft(recipeId),
    stashOp: (op, index) => conn.stashOp(op, index),
    partyOp: (op, target) => conn.partyOp(op, target),
    assignSlot: (slot, item) => conn.assignSlot(slot, item),
    equip: (item) => conn.equip(item),
    drop: (item) => conn.drop(item),
    fistbump: (targetId) => conn.fistbump(targetId),
    pushToast: (msg) => conn.pushToast(msg),
  };
}

/** The inventory window's network intents (HudSceneData.actions), bound straight to the real Connection. */
export function createHudActions(conn: Connection): InventoryActions {
  return {
    assignSlot: (slot, item) => conn.assignSlot(slot, item),
    equip: (item) => conn.equip(item),
    drop: (item) => conn.drop(item),
  };
}

/** The live Connection surface ui/chat/controller.ts's ChatController needs (its ChatPort contract). */
export function createChatPort(conn: Connection): {
  chatLog: Connection["chatLog"];
  chatSeq: number;
  chat: Connection["chat"];
  who: Connection["who"];
  debugGod: Connection["debugGod"];
  debugTeleport: Connection["debugTeleport"];
} {
  return {
    get chatLog() {
      return conn.chatLog;
    },
    get chatSeq() {
      return conn.chatSeq;
    },
    chat: (channel, text, target) => conn.chat(channel, text, target),
    who: () => conn.who(),
    debugGod: (on) => conn.debugGod(on),
    debugTeleport: (x, y) => conn.debugTeleport(x, y),
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
    isDoorNearby: (adapter) => !!conn.world && !!adapter.body && isDoorTileAt(conn.world, adapter.body.x, adapter.body.y),
    downedPartyMemberInRange: (adapter) => {
      if (!adapter.body || !conn.party) return undefined;
      return nearestDownedPartyMember(conn.party.members, adapter.body.x, adapter.body.y, INTERACT_RANGE);
    },
  };
}

export interface SocialHookCallbacks {
  toggleChat(): void;
  toggleInventory(): void;
  openChat(): void;
  toggleContacts(): void;
  closeOverlays(): void;
}

export function createInputHooks(cosmetics: SelfCosmeticsState, social: SocialHookCallbacks): InputHooks {
  return {
    onSwing: (dx, dy) => triggerSelfAttack(cosmetics, performance.now(), dx, dy),
    // Chunk-grid debug overlay isn't built in this wave — GalleryScene's coordinate
    // readout (render/terrain debugging) covers it for now.
    onToggleBorders: () => {},
    onToggleChat: social.toggleChat,
    onToggleInventory: social.toggleInventory,
    onOpenChat: social.openChat,
    onToggleContacts: social.toggleContacts,
    onCloseOverlays: social.closeOverlays,
  };
}
