/** Constructs the interactive HTML HUD panels without lengthening the ThreeHud facade. */
import type { Connection } from "../../../net/connection/connection.js";
import { ThreeHudChat } from "../panels/ThreeHudChat.js";
import { ThreeHudContacts } from "../panels/ThreeHudContacts.js";
import { ThreeHudCraft } from "../panels/ThreeHudCraft.js";
import { ThreeHudStash } from "../panels/ThreeHudStash.js";

export interface ThreeHudPanelActions {
  toggleContacts(): void;
  closeContacts(): void;
  closeCraft(): void;
  closeStash(): void;
}

export interface ThreeHudPanels {
  chat: ThreeHudChat;
  contacts: ThreeHudContacts;
  craft: ThreeHudCraft;
  stash: ThreeHudStash;
}

export interface ThreeHudPanelRequest {
  readonly connection: Connection;
  readonly mobile: boolean;
  readonly focusGame: () => void;
  readonly setTextInputFocused: (focused: boolean) => void;
  readonly actions: ThreeHudPanelActions;
}

export function createThreeHudPanels(request: ThreeHudPanelRequest): ThreeHudPanels {
  const { connection, focusGame, setTextInputFocused, actions } = request;
  const chat = new ThreeHudChat({
    connection,
    focusGame,
    setTextInputFocused,
    toggleContacts: actions.toggleContacts,
  });
  return {
    chat,
    contacts: new ThreeHudContacts((name) => chat.startDm(name), actions.closeContacts),
    craft: new ThreeHudCraft((recipe) => connection.craft(recipe), actions.closeCraft),
    stash: createStashPanel(connection, actions.closeStash),
  };
}

function createStashPanel(connection: Connection, close: () => void): ThreeHudStash {
  return new ThreeHudStash({
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
