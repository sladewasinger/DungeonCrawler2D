/**
 * Live-vs-gallery network-intent bundles for HudWidgets' window widgets, plus their
 * inert no-op stand-ins for the ?hud=1 gallery preview (no live Connection). Split out
 * of index.ts's HudWidgets facade to stay under the file-size cap.
 */
import type { ChatPanelActions } from "./chatPanel.js";
import type { ContactsActions } from "./contactsWindow.js";
import type { CraftActions } from "./craftWindow.js";
import type { InventoryActions } from "./inventoryWindow.js";
import type { StashActions } from "./stashWindow.js";

export function noopInventoryActions(): InventoryActions {
  return { assignSlot: () => {}, equip: () => {}, drop: () => {} };
}

export interface SocialActions {
  chat: ChatPanelActions;
  contacts: ContactsActions;
}

export function noopSocialActions(): SocialActions {
  return {
    chat: { onSelectTab: () => {}, onToggleContacts: () => {} },
    contacts: { startDm: () => {} },
  };
}

/** The crafting-table and stash windows' network intents (Epic 7.12). */
export interface StationActions {
  craft: CraftActions;
  stash: StashActions;
}

export function noopStationActions(): StationActions {
  return { craft: { craft: () => {} }, stash: { put: () => {}, take: () => {} } };
}
