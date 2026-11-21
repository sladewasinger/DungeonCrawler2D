import { bindBandageKey } from "../gameplay/gameplayActions.js";
import { onNumberKey } from "../gameplay/hotbar.js";
import { guardedAction, inputActionBlocked } from "../controls/inputGuard.js";
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
  readonly onThrowAimStart: () => void;
  readonly onThrowAimRelease: (allowThrow: boolean) => void;
  readonly onInteract: () => void;
  readonly onInteractReleased: () => void;
  readonly onBandageDown: () => void;
  readonly onBandageUp: () => void;
  readonly onKidAttack: () => void;
}

interface ThrowAimKeyBinding {
  readonly key: InputState["keys"]["G"];
  readonly blocked: () => boolean;
  readonly onStart: () => void;
  readonly onRelease: (allowThrow: boolean) => void;
}

/** G starts aiming on key-down, but only release is allowed to dispatch a throw. */
export function bindThrowAimKey(request: ThrowAimKeyBinding): void {
  request.key.on("down", () => {
    if (!request.blocked()) request.onStart();
  });
  request.key.on("up", () => request.onRelease(!request.blocked()));
}

export function bindControllerKeys(request: ControllerKeyBindings): void {
  const { keys, conn, panels, state, queries } = request;
  const panelBlocked = () => panels.gameplayBlocked;
  const actionBlocked = () => inputActionBlocked(panelBlocked);
  bindThrowAimKey({
    key: keys.G,
    blocked: actionBlocked,
    onStart: request.onThrowAimStart,
    onRelease: request.onThrowAimRelease,
  });
  bindInteractKey(keys.E, guardedAction(request.onInteract, panelBlocked), request.onInteractReleased);
  keys.R.on("down", guardedAction(() => conn.pickup(), panelBlocked));
  keys.C.on("down", guardedAction(() => {
    if (conn.activeAdmin) return conn.toggleNoclip?.();
    panels.toggleCraft(conn);
  }, panelBlocked));
  bindBandageKey({ key: keys.F, conn, queries, selectedSlot: () => state.selectedSlot,
    fallbackDown: request.onBandageDown, fallbackUp: request.onBandageUp, blocked: panelBlocked });
  keys.N.on("down", guardedAction(request.onKidAttack, panelBlocked));
  bindEscapeKey(request);
  bindPanelKeys(request, panelBlocked);
  bindNumberKeys(request, panelBlocked);
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
