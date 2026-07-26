/** Constructs the interactive HTML HUD panels without lengthening the ThreeHud facade. */
import type { Connection } from "../net/connection.js";
import { ThreeHudChat } from "./ThreeHudChat.js";
import { ThreeHudContacts } from "./ThreeHudContacts.js";
import { ThreeHudCraft } from "./ThreeHudCraft.js";
import { ThreeHudStash } from "./ThreeHudStash.js";

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

export function createThreeHudPanels(
  connection: Connection,
  mobile: boolean,
  focusGame: () => void,
  setTextInputFocused: (focused: boolean) => void,
  actions: ThreeHudPanelActions,
): ThreeHudPanels {
  const chat = new ThreeHudChat(
    connection,
    mobile,
    focusGame,
    setTextInputFocused,
    actions.toggleContacts,
  );
  return {
    chat,
    contacts: new ThreeHudContacts((name) => chat.startDm(name), actions.closeContacts),
    craft: new ThreeHudCraft((recipe) => connection.craft(recipe), actions.closeCraft),
    stash: new ThreeHudStash(
      (index) => {
        if (connection.stashContext.kind === "personal") connection.stashOp("put", index);
      },
      (index, itemId) => {
        const chestId = connection.stashContext.chestId;
        if (connection.stashContext.kind === "loot" && chestId) {
          connection.lootChestOp(chestId, "take", itemId);
        } else connection.stashOp("take", index);
      },
      () => {
        const chestId = connection.stashContext.chestId;
        if (chestId) connection.lootChestOp(chestId, "takeAll");
      },
      actions.closeStash,
    ),
  };
}
