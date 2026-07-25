/** Shared contextual action help for the selected item and equipped weapon. */
import {
  isConsumableItem,
  isThrowableItem,
  itemName,
} from "./itemCatalog.js";

export type ContextualAction = "use" | "throw" | "attack" | "block";

export interface ContextualActionHint {
  readonly action: ContextualAction;
  readonly key: string;
  readonly touchKey: string;
  readonly label: string;
}

export interface ContextualActionContext {
  readonly selectedItemId: string | null;
  readonly weaponId: string | null;
  /** GAME-2 owns this capability. Omit or pass false until blocking is active. */
  readonly canBlock?: boolean;
}

const hint = (
  action: ContextualAction,
  key: string,
  touchKey: string,
  label: string,
): ContextualActionHint => ({ action, key, touchKey, label });

/** Returns only actions that are valid for the current item/weapon context. */
export function resolveContextualActionHelp(
  context: ContextualActionContext,
): ContextualActionHint[] {
  const hints: ContextualActionHint[] = [];
  const selected = context.selectedItemId;
  if (selected && isConsumableItem(selected)) {
    hints.push(hint("use", "E", "USE", `Use ${itemName(selected)}`));
  }
  if (selected && isThrowableItem(selected)) {
    hints.push(hint("throw", "G", "THROW", `Throw ${itemName(selected)}`));
  }
  if (context.weaponId) {
    const weaponName = itemName(context.weaponId);
    hints.push(hint("attack", "LMB", "ATTACK", `Attack with ${weaponName}`));
    if (context.canBlock === true) {
      hints.push(hint("block", "RMB", "BLOCK", `Block with ${weaponName}`));
    }
  }
  return hints;
}
