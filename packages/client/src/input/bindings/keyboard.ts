import { bindBandageKey } from "../gameplay/gameplayActions.js";
import { onNumberKey } from "../gameplay/hotbar.js";
import { guardedAction } from "../controls/inputGuard.js";
import { bindInteractKey } from "../gestures/interactKey.js";
import type { InputConnection, InputHooks, InputPanels, InputQueries, InputState } from "../controls/state.js";

export interface ControllerKeyBindings {
  readonly keys: InputState["keys"];
  readonly keyboard: { addKey(keyCode: number): { on(event: string, listener: () => void): unknown } } | null;
  readonly conn: InputConnection;
  readonly panels: InputPanels;
  readonly state: InputState;
  readonly queries: InputQueries;
  readonly hooks: InputHooks;
  readonly onGod: () => void;
  readonly onInteract: () => void;
  readonly onInteractReleased: () => void;
  readonly onBandageDown: () => void;
  readonly onBandageUp: () => void;
  readonly onKidAttack: () => void;
}

export function bindControllerKeys(request: ControllerKeyBindings): void {
  const { keys, conn, panels, state, queries } = request;
  const blocked = () => panels.gameplayBlocked;
  keys.G.on("down", guardedAction(request.onGod, blocked));
  bindInteractKey(keys.E, guardedAction(request.onInteract, blocked), request.onInteractReleased);
  keys.R.on("down", guardedAction(() => conn.pickup(), blocked));
  keys.C.on("down", guardedAction(() => panels.toggleCraft(conn), blocked));
  bindBandageKey({ key: keys.F, conn, queries, selectedSlot: () => state.selectedSlot,
    fallbackDown: request.onBandageDown, fallbackUp: request.onBandageUp, blocked });
  keys.N.on("down", guardedAction(request.onKidAttack, blocked));
  bindEscapeKey(request);
  bindPanelKeys(request, blocked);
  bindNumberKeys(request, blocked);
}

function bindEscapeKey({ keys, state, panels, conn, hooks }: ControllerKeyBindings): void {
  keys.ESC.on("down", () => {
    state.selectedSlot = null;
    const panelsWereOpen = panels.inventoryOpen || panels.craftOpen || panels.stashOpen;
    panels.closeAll(conn);
    if (!panelsWereOpen && !hooks.onCloseOverlays()) hooks.onToggleSessionMenu();
  });
}

function bindPanelKeys({ keys, hooks }: ControllerKeyBindings, blocked: () => boolean): void {
  keys.I.on("down", guardedAction(hooks.onToggleInventory, blocked));
  keys.TAB.on("down", guardedAction(hooks.onToggleInventory, blocked));
  keys.ENTER.on("down", guardedAction(hooks.onOpenChat, blocked));
  keys.O.on("down", guardedAction(hooks.onToggleContacts, blocked));
}

function bindNumberKeys(request: ControllerKeyBindings, blocked: () => boolean): void {
  const { keyboard, state, conn, panels, queries, keys } = request;
  if (!keyboard) throw new Error("scene has no keyboard plugin");
  for (let number = 1; number <= 9; number++) {
    keyboard.addKey(48 + number).on("down", guardedAction(
      () => onNumberKey({ state, conn, panels, queries, keys, number }), blocked));
  }
}
