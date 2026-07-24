/** Derives contextual first-time HUD guidance from successive inventory and health snapshots. */
import type { InvStack } from "@dc2d/engine";
import { isConsumableItem, isThrowableItem } from "../itemCatalog.js";

export type TutorialId = "inventory" | "throwable" | "usable" | "low-health";
export type TutorialInputMode = "keyboard" | "touch";

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
  mode: TutorialInputMode,
): TutorialMessage => {
  const slot = hotbar.indexOf(item) + 1;
  const select = mode === "touch"
    ? `Tap hotbar slot [${slot}]`
    : `Press [${slot}] to equip`;
  const use = mode === "touch" ? "tap [USE]" : "[E]";
  return {
    id: "usable",
    text: item === "bandage"
      ? `${select}, then ${use} to apply the bandage.`
      : `${select}, then ${use} to use ${item}.`,
    persistent: true,
  };
};

const lowHealthMessage = (
  hotbar: readonly (string | null)[],
  mode: TutorialInputMode,
): TutorialMessage => {
  const bandageSlot = hotbar.indexOf("bandage");
  const action = mode === "touch"
    ? `Tap slot [${bandageSlot + 1}], then tap [USE]`
    : `Press [${bandageSlot + 1}], then [E]`;
  return {
    id: "low-health",
    text: bandageSlot >= 0
      ? `Health low! ${action} to heal.`
      : `Health low! ${mode === "touch" ? "Tap [BAG]" : "Open your inventory"} and use a bandage.`,
    persistent: false,
  };
};

const inventoryPickupMessage = (
  state: TutorialState,
  snapshot: TutorialSnapshot,
  mode: TutorialInputMode,
): TutorialMessage | null => {
  const pickedUp = state.initialized && snapshot.inventory.some((stack) =>
    stack.qty > (state.inventory.get(stack.item) ?? 0)
  );
  if (!pickedUp) return null;
  return {
    id: "inventory",
    text: mode === "touch"
      ? "Tap [BAG] to open your inventory."
      : "Press [Tab] to open your inventory.",
    persistent: true,
  };
};

const assignmentMessages = (
  assigned: readonly string[],
  hotbar: readonly (string | null)[],
  mode: TutorialInputMode,
): TutorialMessage[] => {
  const messages: TutorialMessage[] = [];
  if (assigned.find(isThrowableItem)) {
    messages.push({
      id: "throwable",
      text: mode === "touch"
        ? "Select the item, then tap [THROW]."
        : "Press [G] to throw the selected item.",
      persistent: true,
    });
  }
  const usable = assigned.find(isConsumableItem);
  if (usable) messages.push(usableMessage(hotbar, usable, mode));
  return messages;
};

export const advanceTutorials = (
  state: TutorialState,
  snapshot: TutorialSnapshot,
  mode: TutorialInputMode = "keyboard",
): TutorialMessage[] => {
  const nextInventory = quantities(snapshot.inventory);
  const healthIsLow = snapshot.maxHp > 0 && snapshot.hp / snapshot.maxHp < 0.3;
  const assigned = assignedItems(state.hotbar, snapshot.hotbar);
  const messages = assignmentMessages(assigned, snapshot.hotbar, mode);
  const inventoryMessage = inventoryPickupMessage(state, snapshot, mode);
  if (inventoryMessage) messages.unshift(inventoryMessage);
  if (healthIsLow && !state.healthWasLow) {
    messages.push(lowHealthMessage(snapshot.hotbar, mode));
  }
  state.initialized = true;
  state.inventory = nextInventory;
  state.hotbar = [...snapshot.hotbar];
  state.healthWasLow = healthIsLow;
  return messages;
};
