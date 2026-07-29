/** Constructs the interactive HTML HUD panels without lengthening the Hud facade. */
import type { Connection } from "../../../net/connection/connection.js";
import { HudChat } from "../panels/HudChat.js";
import { HudContacts } from "../panels/HudContacts.js";
import { HudCraft } from "../panels/HudCraft.js";
import { HudStash } from "../panels/HudStash.js";

export interface HudPanelActions {
  toggleContacts(): void;
  closeContacts(): void;
  closeCraft(): void;
  closeStash(): void;
}

export interface HudPanels {
  chat: HudChat;
  contacts: HudContacts;
  craft: HudCraft;
  stash: HudStash;
}

export interface HudPanelRequest {
  readonly connection: Connection;
  readonly mobile: boolean;
  readonly focusGame: () => void;
  readonly setTextInputFocused: (focused: boolean) => void;
  readonly actions: HudPanelActions;
}

export function createHudPanels(request: HudPanelRequest): HudPanels {
  const { connection, focusGame, setTextInputFocused, actions } = request;
  const chat = new HudChat({
    connection,
    focusGame,
    setTextInputFocused,
    toggleContacts: actions.toggleContacts,
  });
  return {
    chat,
    contacts: new HudContacts((name) => chat.startDm(name), actions.closeContacts),
    craft: new HudCraft((recipe) => connection.craft(recipe), actions.closeCraft),
    stash: createStashPanel(connection, actions.closeStash),
  };
}

function createStashPanel(connection: Connection, close: () => void): HudStash {
  return new HudStash({
      put: (index) => {
        if (connection.stashContext.kind === "personal") connection.stashOp("put", index);
      },
      take: (index, itemId) => {
        const chestId = connection.stashContext.chestId;
        if (connection.stashContext.kind === "loot" && chestId) {
          connection.lootChestOp(chestId, "take", itemId);
        } else connection.stashOp("take", index);
      },
      takeAll: () => {
        const chestId = connection.stashContext.chestId;
        if (chestId) connection.lootChestOp(chestId, "takeAll");
      },
    close,
  });
}
