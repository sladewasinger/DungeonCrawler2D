/** Derives contextual first-time HUD guidance from successive inventory and health snapshots. */
import type { InvStack } from "@dc2d/engine";
import { isConsumableItem, isThrowableItem } from "../presentation/itemCatalog.js";

export type TutorialId =
  | "hotbar"
  | "inventory"
  | "throwable"
  | "usable"
  | "low-health";
export type TutorialInputMode = "keyboard" | "touch";

export interface TutorialMessage {
  id: TutorialId;
  text: string;
  persistent: boolean;
}

export interface TutorialSnapshot {
  inventory: readonly InvStack[];
  hotbar: readonly (string | null)[];
  selectedSlot: number | null;
  hp: number;
  maxHp: number;
}

export interface TutorialState {
  initialized: boolean;
  inventory: Map<string, number>;
  selectedSlot: number | null;
  healthWasLow: boolean;
}

export const createTutorialState = (): TutorialState => ({
  initialized: false,
  inventory: new Map(),
  selectedSlot: null,
  healthWasLow: false,
});

const quantities = (inventory: readonly InvStack[]) =>
  new Map(inventory.map((stack) => [stack.item, stack.qty]));

const usableMessage = (
  item: string,
  mode: TutorialInputMode,
): TutorialMessage => {
  return {
    id: "usable",
    text: item === "bandage"
      ? mode === "touch"
        ? "Tap [USE] to apply the selected bandage."
        : "Press [E] to apply the selected bandage."
      : mode === "touch"
        ? `Tap [USE] to use the selected ${item}.`
        : `Press [E] to use the selected ${item}.`,
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

const hotbarMessage = (mode: TutorialInputMode): TutorialMessage => ({
  id: "hotbar",
  text: mode === "touch"
    ? "Tap [1–9] to select a hotbar item."
    : "Press [1–9] to select a hotbar item.",
  persistent: true,
});

const selectedItem = (
  state: TutorialState,
  snapshot: TutorialSnapshot,
  inventory: ReadonlyMap<string, number>,
): string | null => {
  if (
    !state.initialized ||
    snapshot.selectedSlot === null ||
    snapshot.selectedSlot === state.selectedSlot
  ) return null;
  const item = snapshot.hotbar[snapshot.selectedSlot] ?? null;
  return item && (inventory.get(item) ?? 0) > 0 ? item : null;
};

const selectionMessage = (
  item: string | null,
  mode: TutorialInputMode,
): TutorialMessage | null => {
  if (!item) return null;
  if (isThrowableItem(item)) {
    return {
      id: "throwable",
      text: mode === "touch"
        ? "Tap [THROW] to throw the selected item."
        : "Hold [G] to aim; release to throw the selected item.",
      persistent: true,
    };
  }
  return isConsumableItem(item) ? usableMessage(item, mode) : null;
};

const crossedLowHealthThreshold = (
  state: TutorialState,
  healthIsLow: boolean,
  bandageAvailable: boolean,
) => state.initialized && healthIsLow && !state.healthWasLow && bandageAvailable;

export const advanceTutorials = (
  state: TutorialState,
  snapshot: TutorialSnapshot,
  mode: TutorialInputMode = "keyboard",
): TutorialMessage[] => {
  const nextInventory = quantities(snapshot.inventory);
  const healthIsLow = snapshot.maxHp > 0 && snapshot.hp / snapshot.maxHp < 0.3;
  const messages = state.initialized ? [] : [hotbarMessage(mode)];
  const inventoryMessage = inventoryPickupMessage(state, snapshot, mode);
  if (inventoryMessage) messages.unshift(inventoryMessage);
  const actionMessage = selectionMessage(
    selectedItem(state, snapshot, nextInventory),
    mode,
  );
  if (actionMessage) messages.push(actionMessage);
  const bandageAvailable = (nextInventory.get("bandage") ?? 0) > 0;
  if (crossedLowHealthThreshold(state, healthIsLow, bandageAvailable)) {
    messages.push(lowHealthMessage(snapshot.hotbar, mode));
  }
  state.initialized = true;
  state.inventory = nextInventory;
  state.selectedSlot = snapshot.selectedSlot;
  state.healthWasLow = healthIsLow;
  return messages;
};
