/** Shared keyboard shortcut guards and touch joystick DOM helpers for InputController. */

export interface InputCallbacks {
  readonly onToggleTorch: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onSelectHotbar: (slot: number) => void;
  readonly onToggleInventory: () => void;
  readonly onToggleCharacter: () => void;
  readonly onToggleMap?: () => void;
  readonly onInteract?: () => void;
  readonly onDismantle?: () => void;
  readonly onRotateGhost?: () => void;
  readonly onPlaceGhost?: () => boolean;
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

const UI_OVERLAY_SELECTOR =
  ".ow-hud, .ow-hotbar, .ow-modal, .ow-settings-modal, .ow-stamina-rail, .ow-zoom-controls, .ow-jump-btn, .ow-combat-cluster, .ow-vitals, .ow-item-card, .ow-chat-ui";

const HOTBAR_DIGIT_MAP: Readonly<Record<string, number>> = {
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

export function computeTouchStickVector(opts: {
  readonly dx: number; readonly dy: number; readonly maxRadius: number; readonly deadzone: number;
}): { readonly vector: { readonly x: number; readonly y: number }; readonly dist: number; readonly kx: number; readonly ky: number } {
  const dist = Math.hypot(opts.dx, opts.dy);
  const clamped = Math.min(dist, opts.maxRadius);
  const nx = dist > 2 ? opts.dx / dist : 0;
  const ny = dist > 2 ? opts.dy / dist : 0;
  const strength = clamped / opts.maxRadius;
  const speed = strength > opts.deadzone ? 0.22 + ((strength - opts.deadzone) / (1 - opts.deadzone)) * 0.78 : 0;
  return {
    dist, kx: nx * clamped, ky: ny * clamped,
    vector: speed > 0 ? { x: nx * speed, y: ny * speed } : { x: 0, y: 0 },
  };
}

export function applyPriorityKeyboardAction(opts: {
  readonly e: KeyboardEvent; readonly callbacks: InputCallbacks; readonly onJump: () => void; readonly onDodge: () => void;
}): boolean {
  const { e, callbacks, onJump, onDodge } = opts;
  const hotbarIdx = HOTBAR_DIGIT_MAP[e.code];
  if (hotbarIdx !== undefined) { callbacks.onSelectHotbar(hotbarIdx); return true; }
  const special: Readonly<Record<string, () => void>> = {
    Tab: () => { e.preventDefault(); callbacks.onToggleInventory(); },
    Enter: () => { e.preventDefault(); callbacks.onOpenChat?.(); },
    NumpadEnter: () => { e.preventDefault(); callbacks.onOpenChat?.(); },
    Space: () => { e.preventDefault(); onJump(); },
    ControlLeft: onDodge,
    ControlRight: onDodge,
  };
  const fn = special[e.code];
  if (!fn) return false;
  fn();
  return true;
}

export function applyControllerKeyboardAction(opts: {
  readonly code: string; readonly e: KeyboardEvent; readonly callbacks: InputCallbacks; readonly crouch: { readonly mode: "toggle" | "hold"; readonly value: boolean };
  readonly onInteractHoldStart: () => void; readonly onThrowPebble: () => void; readonly onSyncCrouch: (next: boolean) => void;
}): void {
  const { code, callbacks, crouch } = opts;
  const actions: Readonly<Record<string, () => void>> = {
    KeyE: opts.onInteractHoldStart,
    KeyR: () => { callbacks.onRotateGhost?.(); },
    KeyZ: () => { callbacks.onDismantle?.(); },
    KeyC: () => opts.onSyncCrouch(nextCrouchState(crouch.mode, crouch.value, "press")),
    KeyQ: () => { callbacks.onDropItem?.(); },
    Delete: () => { callbacks.onDropItem?.(); },
    Backspace: () => { callbacks.onDropItem?.(); },
    KeyX: opts.onThrowPebble,
    KeyH: callbacks.onToggleCharacter,
    KeyF: callbacks.onToggleTorch,
    KeyM: () => { callbacks.onToggleMap?.(); },
    Escape: callbacks.onClosePanels,
  };
  actions[code]?.();
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