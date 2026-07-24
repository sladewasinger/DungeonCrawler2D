/** Derives contextual first-time HUD guidance from successive inventory and health snapshots. */
import type { InvStack } from "@dc2d/engine";
import { isConsumableItem, isThrowableItem } from "../itemCatalog.js";

export type TutorialId = "inventory" | "throwable" | "usable" | "low-health";

export interface TutorialMessage {
  id: TutorialId;
  text: string;
  persistent: boolean;
}

export interface TutorialSnapshot {
  inventory: readonly InvStack[];
  hotbar: readonly (string | null)[];
  hp: number;
  maxHp: number;
}

export interface TutorialState {
  initialized: boolean;
  inventory: Map<string, number>;
  hotbar: readonly (string | null)[];
  healthWasLow: boolean;
}

export const createTutorialState = (): TutorialState => ({
  initialized: false,
  inventory: new Map(),
  hotbar: [],
  healthWasLow: false,
});

const quantities = (inventory: readonly InvStack[]) =>
  new Map(inventory.map((stack) => [stack.item, stack.qty]));

const assignedItems = (
  previous: readonly (string | null)[],
  current: readonly (string | null)[],
) => current.filter((item, index): item is string =>
  item !== null && item !== previous[index]
);

const usableMessage = (
  hotbar: readonly (string | null)[],
  item: string,
): TutorialMessage => {
  const slot = hotbar.indexOf(item) + 1;
  return {
    id: "usable",
    text: item === "bandage"
      ? `Press [${slot}] to equip, then [E] to apply the bandage.`
      : `Press [${slot}] to select ${item}, then [E] to use it.`,
    persistent: true,
  };
};

const lowHealthMessage = (
  hotbar: readonly (string | null)[],
): TutorialMessage => {
  const bandageSlot = hotbar.indexOf("bandage");
  return {
    id: "low-health",
    text: bandageSlot >= 0
      ? `Health low! Press [${bandageSlot + 1}], then [E] to heal.`
      : "Health low! Open your inventory and use a bandage.",
    persistent: false,
  };
};

export const advanceTutorials = (
  state: TutorialState,
  snapshot: TutorialSnapshot,
): TutorialMessage[] => {
  const nextInventory = quantities(snapshot.inventory);
  const healthIsLow = snapshot.maxHp > 0 && snapshot.hp / snapshot.maxHp < 0.3;
  const assigned = assignedItems(state.hotbar, snapshot.hotbar);
  const messages: TutorialMessage[] = [];
  if (state.initialized && snapshot.inventory.some((stack) =>
    stack.qty > (state.inventory.get(stack.item) ?? 0)
  )) {
    messages.push({
      id: "inventory",
      text: "Press [Tab] to open your inventory.",
      persistent: true,
    });
  }
  const throwable = assigned.find(isThrowableItem);
  if (throwable) {
    messages.push({
      id: "throwable",
      text: "Press [G] to throw the selected item.",
      persistent: true,
    });
  }
  const usable = assigned.find(isConsumableItem);
  if (usable) messages.push(usableMessage(snapshot.hotbar, usable));
  if (healthIsLow && !state.healthWasLow) {
    messages.push(lowHealthMessage(snapshot.hotbar));
  }
  state.initialized = true;
  state.inventory = nextInventory;
  state.hotbar = [...snapshot.hotbar];
  state.healthWasLow = healthIsLow;
  return messages;
};
