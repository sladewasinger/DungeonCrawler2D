/** Shared contextual action help for the selected item and equipped weapon. */
import {
  isConsumableItem,
  isThrowableItem,
  itemName,
} from "../presentation/itemCatalog.js";

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

interface HintInput {
  readonly action: ContextualAction;
  readonly key: string;
  readonly touchKey: string;
  readonly label: string;
}

const hint = (input: HintInput): ContextualActionHint => input;

/** Returns only actions that are valid for the current item/weapon context. */
export function resolveContextualActionHelp(
  context: ContextualActionContext,
): ContextualActionHint[] {
  const hints: ContextualActionHint[] = [];
  addSelectedItemHints(hints, context.selectedItemId);
  addWeaponHints(hints, context.weaponId, context.canBlock === true);
  return hints;
}

function addSelectedItemHints(hints: ContextualActionHint[], selected: string | null): void {
  if (!selected) return;
  if (isConsumableItem(selected)) hints.push(hint({ action: "use", key: "E", touchKey: "USE", label: `Use ${itemName(selected)}` }));
  if (isThrowableItem(selected)) hints.push(hint({ action: "throw", key: "G", touchKey: "THROW", label: `Throw ${itemName(selected)}` }));
}

function addWeaponHints(hints: ContextualActionHint[], weaponId: string | null, canBlock: boolean): void {
  if (!weaponId) return;
  const weaponName = itemName(weaponId);
  hints.push(hint({ action: "attack", key: "LMB", touchKey: "ATTACK", label: `Attack with ${weaponName}` }));
  if (canBlock) hints.push(hint({ action: "block", key: "RMB", touchKey: "BLOCK", label: `Block with ${weaponName}` }));
}
