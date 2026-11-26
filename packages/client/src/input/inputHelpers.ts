/** Shared keyboard shortcut guards and touch joystick DOM helpers for InputController. */

export interface InputCallbacks {
  readonly onToggleTorch: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onSelectHotbar: (slot: number) => void;
  readonly onToggleInventory: () => void;
  readonly onToggleCharacter: () => void;
  readonly onToggleMap?: () => void;
  readonly onInteract?: () => void;
  readonly onDropItem?: () => void;
  readonly onWorldTap?: (clientX: number, clientY: number) => void;
  readonly onOpenChat?: () => void;
  readonly onClosePanels: () => void;
}

export interface CombatInputsFrame {
  readonly attack: boolean;
  readonly attackHold: boolean;
  readonly bowDraw: boolean;
  readonly bowRelease: boolean;
  readonly block: boolean;
  readonly dodge: boolean;
  readonly dodgeDir: { readonly x: number; readonly y: number } | undefined;
  readonly crouch: boolean;
  readonly throwPebble: boolean;
  readonly interact: boolean;
  readonly mobileAim: { readonly x: number; readonly y: number } | undefined;
}

const GUARDED_BROWSER_COMBOS = new Set([
  "KeyS", "KeyO", "KeyP", "KeyF", "KeyD", "KeyG", "KeyH", "KeyJ", "KeyU", "KeyK", "KeyL", "KeyE", "KeyB", "KeyA",
]);
const GUARDED_ALWAYS_COMBOS = new Set(["KeyS", "KeyO", "KeyP"]);

export const UI_OVERLAY_SELECTOR =
  ".ow-hud, .ow-hotbar, .ow-modal, .ow-settings-modal, .ow-stamina-rail, .ow-zoom-controls, .ow-jump-btn, .ow-combat-cluster, .ow-vitals, .ow-item-card, .ow-chat-ui";

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

function resolveAttackAndBow(opts: {
  readonly isBowHeld: boolean; readonly leftMouseDown: boolean; readonly bowReleaseQueued: boolean;
  readonly mob: { readonly attackHold: boolean; readonly bowDraw: boolean; readonly bowRelease: boolean };
}) {
  return {
    attackHold: !opts.isBowHeld && (opts.leftMouseDown || opts.mob.attackHold),
    bowDraw: opts.mob.bowDraw || (opts.isBowHeld && opts.leftMouseDown),
    bowRelease: opts.bowReleaseQueued || opts.mob.bowRelease,
  };
}

export function assembleCombatFrame(opts: {
  readonly attack: boolean; readonly dodge: boolean;
  readonly attackQueued: boolean; readonly bowReleaseQueued: boolean;
  readonly leftMouseDown: boolean; readonly rightMouseDown: boolean;
  readonly isBowHeld: boolean; readonly hasShield: boolean;
  readonly crouching: boolean; readonly throwPebble: boolean; readonly interact: boolean;
  readonly dodgeDir: { readonly x: number; readonly y: number } | undefined;
  readonly mob: {
    readonly attackHold: boolean; readonly bowDraw: boolean; readonly bowRelease: boolean;
    readonly block: boolean; readonly crouch: boolean;
    readonly aim: { readonly x: number; readonly y: number } | undefined;
  };
}) {
  const { mob } = opts;
  return {
    attack: opts.attack,
    ...resolveAttackAndBow(opts),
    block: opts.hasShield && (opts.rightMouseDown || mob.block),
    dodge: opts.dodge,
    dodgeDir: opts.dodge ? opts.dodgeDir : undefined,
    crouch: opts.crouching || mob.crouch,
    throwPebble: opts.throwPebble,
    interact: opts.interact,
    mobileAim: mob.aim,
  };
}

export function nextCrouchState(mode: "toggle" | "hold", current: boolean, action: "press" | "release" | "blur"): boolean {
  if (mode === "hold") return action === "press";
  return action === "press" ? !current : current;
}