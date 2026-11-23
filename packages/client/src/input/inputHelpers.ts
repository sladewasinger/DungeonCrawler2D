/** Shared keyboard shortcut guards and touch joystick DOM helpers for InputController. */

const GUARDED_BROWSER_COMBOS = new Set([
  "KeyS", "KeyO", "KeyP", "KeyF", "KeyD", "KeyG", "KeyH", "KeyJ", "KeyU", "KeyK", "KeyL", "KeyE", "KeyB", "KeyA",
]);
const GUARDED_ALWAYS_COMBOS = new Set(["KeyS", "KeyO", "KeyP"]);

export const UI_OVERLAY_SELECTOR =
  ".ow-hud, .ow-hotbar, .ow-modal, .ow-settings-modal, .ow-stamina-rail, .ow-zoom-controls, .ow-jump-btn, .ow-combat-cluster, .ow-vitals";

export const HOTBAR_DIGIT_MAP: Readonly<Record<string, number>> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4,
  Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8,
};

export function isGuardedBrowserCombo(e: KeyboardEvent, editingText: boolean): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return false;
  return editingText ? GUARDED_ALWAYS_COMBOS.has(e.code) : GUARDED_BROWSER_COMBOS.has(e.code);
}

export function isEditingText(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

export function isUiTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest(UI_OVERLAY_SELECTOR));
}

export function createJoystickDom(): { readonly ring: HTMLDivElement; readonly knob: HTMLDivElement } {
  const ring = document.createElement("div");
  ring.className = "ow-joystick";
  const knob = document.createElement("div");
  knob.className = "ow-joystick__knob";
  ring.appendChild(knob);
  return { ring, knob };
}

export function createJumpButton(onPress: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ow-jump-btn";
  btn.textContent = "JUMP";
  btn.setAttribute("aria-label", "Jump");
  btn.addEventListener("pointerdown", (e) => { e.stopPropagation(); onPress(); });
  return btn;
}