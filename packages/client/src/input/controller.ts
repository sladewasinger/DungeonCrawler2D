/** Touch joystick + combat buttons, world tap, desktop WASD, and keyboard shortcuts. */
import { resolveBlockMode } from "@dc2d/content";
import { COMBAT_TUNING } from "@dc2d/engine";
import {
  HOTBAR_DIGIT_MAP, assembleCombatFrame, createJoystickDom, isEditingText, isGuardedBrowserCombo,
  isUiTarget, nextCrouchState, type CombatInputsFrame, type InputCallbacks,
} from "./inputHelpers.js";
import {
  activeInputMode, isTouchInputActive, setActiveInputMode, shouldSwitchToDesktopOnMouseMove, syncInputModeFromPointerDown,
} from "./inputMode.js";
import { MobileCombatControls } from "./mobileCombatControls.js";

export type { CombatInputsFrame, InputCallbacks } from "./inputHelpers.js";

export class InputController {
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private touchVector = { x: 0, y: 0 };
  private mouseClient: { x: number; y: number } | null = null;
  private lastMouseMove: { x: number; y: number } | null = null;
  private mouseMovedAtMs = 0;
  private lastTouchAtMs = -1000;
  private touchStartMs = 0;
  private touchMaxDist = 0;
  private jumpQueued = false;
  private dodgeQueued = false;
  private dodgeDir: { readonly x: number; readonly y: number } | undefined;
  private crouching = false;
  private crouchMode: "toggle" | "hold" = "toggle";
  private throwPebbleQueued = false;
  private interactQueued = false;
  private attackQueued = false;
  private bowReleaseQueued = false;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private isBowHeld = false;
  private canBlock = false;
  private enabled = true;
  private readonly callbacks: InputCallbacks;
  private readonly stickEl: HTMLDivElement;
  private readonly knobEl: HTMLDivElement;
  private readonly mobileCombat: MobileCombatControls;

  constructor(host: HTMLElement, callbacks: InputCallbacks) {
    this.callbacks = callbacks;
    const { ring, knob } = createJoystickDom();
    this.stickEl = ring;
    this.knobEl = knob;
    host.append(ring);
    this.mobileCombat = new MobileCombatControls(host, {
      onMapTap: () => callbacks.onToggleMap?.(),
      onJump: () => { this.jumpQueued = true; this.syncCrouch(false); },
    });
    this.bindKeyboard(callbacks);
    this.bindPointer(host, callbacks);
    activeInputMode();
  }

  setCrouchMode(mode: "toggle" | "hold"): void { this.crouchMode = mode; }
  setGearState(gear: { readonly heldItem: string | null; readonly hasShield: boolean }): void {
    this.isBowHeld = gear.heldItem === "bow";
    this.canBlock = resolveBlockMode(gear.heldItem, gear.hasShield ? "wooden-shield" : null) !== "none";
    this.mobileCombat.setGear(gear);
  }
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.resetHeldInputs();
  }
  queueInteract(): void { this.interactQueued = true; }
  consumeJump(): boolean { const fired = this.jumpQueued; this.jumpQueued = false; return fired; }

  consumeCombat(): CombatInputsFrame {
    const mob = this.mobileCombat.consumeState();
    const dodge = this.dodgeQueued || mob.dodge;
    const attack = this.attackQueued || mob.attack;
    if (dodge || attack || this.down("ShiftLeft", "ShiftRight")) this.syncCrouch(false);
    const out = assembleCombatFrame({
      attack, dodge, attackQueued: this.attackQueued, bowReleaseQueued: this.bowReleaseQueued,
      leftMouseDown: this.leftMouseDown, rightMouseDown: this.rightMouseDown, isBowHeld: this.isBowHeld,
      hasShield: this.canBlock, crouching: this.crouching, throwPebble: this.throwPebbleQueued,
      interact: this.interactQueued, dodgeDir: this.dodgeQueued ? this.dodgeDir : undefined, mob,
    });
    this.clearQueuedCombat();
    return out;
  }

  private syncCrouch(next: boolean): void {
    this.crouching = next;
    this.mobileCombat.setCrouching(next);
  }

  movement(): { readonly x: number; readonly y: number } {
    if (this.pointerId !== null) return this.touchVector;
    const rawX = (this.down("KeyD", "ArrowRight") ? 1 : 0) - (this.down("KeyA", "ArrowLeft") ? 1 : 0);
    const rawY = (this.down("KeyS", "ArrowDown") ? 1 : 0) - (this.down("KeyW", "ArrowUp") ? 1 : 0);
    const mag = Math.hypot(rawX, rawY);
    if (mag < 0.01) return { x: 0, y: 0 };
    const ratio = this.down("ShiftLeft", "ShiftRight") ? 1 : COMBAT_TUNING.movement.walkSpeedRatio;
    return { x: (rawX / mag) * ratio, y: (rawY / mag) * ratio };
  }

  mouseAim(nowMs: number): { readonly x: number; readonly y: number; readonly recent: boolean } | null {
    if (isTouchInputActive() || !this.mouseClient) return null;
    return { x: this.mouseClient.x, y: this.mouseClient.y, recent: nowMs - this.mouseMovedAtMs < 1500 };
  }

  private clearQueuedCombat(): void {
    this.attackQueued = false; this.bowReleaseQueued = false;
    this.dodgeQueued = false; this.dodgeDir = undefined;
    this.throwPebbleQueued = false; this.interactQueued = false;
  }

  private down(...codes: readonly string[]): boolean { return codes.some((c) => this.keys.has(c)); }

  private bindKeyboard(callbacks: InputCallbacks): void {
    window.addEventListener("keydown", (e) => {
      const editing = isEditingText(e.target);
      if (this.enabled && isGuardedBrowserCombo(e, editing)) e.preventDefault();
      if (!this.enabled || editing) { if (this.enabled && e.code === "Escape") (e.target as HTMLElement).blur(); return; }
      setActiveInputMode("desktop");
      this.keys.add(e.code);
      if (!e.repeat) this.handleShortcut(e, callbacks);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "KeyC" && this.crouchMode === "hold") this.syncCrouch(nextCrouchState(this.crouchMode, this.crouching, "release"));
    });
    window.addEventListener("blur", () => this.resetHeldInputs());
  }

  private resetHeldInputs(): void {
    this.keys.clear(); this.leftMouseDown = false; this.rightMouseDown = false;
    this.pointerId = null; this.touchVector = { x: 0, y: 0 }; this.stickEl.style.display = "none";
    this.mobileCombat.resetHeldInputs();
    this.syncCrouch(nextCrouchState(this.crouchMode, this.crouching, "blur"));
  }

  private handlePriorityKey(e: KeyboardEvent, callbacks: InputCallbacks): boolean {
    const hotbarIdx = HOTBAR_DIGIT_MAP[e.code];
    if (hotbarIdx !== undefined) { callbacks.onSelectHotbar(hotbarIdx); return true; }
    const special: Readonly<Record<string, () => void>> = {
      Tab: () => { e.preventDefault(); callbacks.onToggleInventory(); },
      Enter: () => { e.preventDefault(); callbacks.onOpenChat?.(); },
      NumpadEnter: () => { e.preventDefault(); callbacks.onOpenChat?.(); },
      Space: () => { e.preventDefault(); this.jumpQueued = true; this.syncCrouch(false); },
      ControlLeft: () => { this.dodgeQueued = true; },
      ControlRight: () => { this.dodgeQueued = true; },
    };
    const fn = special[e.code];
    if (!fn) return false;
    fn();
    return true;
  }

  private handleShortcut(e: KeyboardEvent, callbacks: InputCallbacks): void {
    if (this.handlePriorityKey(e, callbacks)) return;
    const actions: Readonly<Record<string, () => void>> = {
      KeyE: () => { if (!callbacks.onInteract) this.interactQueued = true; callbacks.onInteract?.(); },
      KeyC: () => this.syncCrouch(nextCrouchState(this.crouchMode, this.crouching, "press")),
      KeyQ: () => { callbacks.onDropItem?.(); },
      Delete: () => { callbacks.onDropItem?.(); },
      Backspace: () => { callbacks.onDropItem?.(); },
      KeyX: () => { this.throwPebbleQueued = true; },
      KeyH: callbacks.onToggleCharacter,
      KeyF: callbacks.onToggleTorch,
      KeyM: () => { callbacks.onToggleMap?.(); },
      Escape: callbacks.onClosePanels,
    };
    actions[e.code]?.();
  }

  private bindPointer(host: HTMLElement, callbacks: InputCallbacks): void {
    window.addEventListener("pointerdown", (e) => this.handleWindowPointerDown(e), { passive: true });
    host.addEventListener("wheel", (e) => { if (!this.enabled) return; e.preventDefault(); callbacks.onZoom(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    host.addEventListener("contextmenu", (e) => { if (this.enabled && !isUiTarget(e.target)) e.preventDefault(); });
    host.addEventListener("pointerdown", (e) => { if (!this.enabled) return; this.startTouch(e); this.onMouseDown(e); });
    host.addEventListener("pointermove", (e) => { this.moveTouch(e); this.trackMouseAim(e); });
    host.addEventListener("pointerup", (e) => { this.endTouch(e, true); this.onMouseUp(e); });
    host.addEventListener("pointercancel", (e) => { this.endTouch(e, false); this.onMouseUp(e); });
  }

  private handleWindowPointerDown(e: PointerEvent): void {
    const now = performance.now();
    syncInputModeFromPointerDown(e.pointerType, now - this.lastTouchAtMs);
    if (e.pointerType !== "touch") return;
    this.lastTouchAtMs = now;
    this.mouseClient = null;
    this.lastMouseMove = null;
  }

  private onMouseDown(e: PointerEvent): void {
    if (e.pointerType !== "mouse" || isUiTarget(e.target) || performance.now() - this.lastTouchAtMs <= 500) return;
    this.mouseClient = { x: e.clientX, y: e.clientY };
    this.mouseMovedAtMs = performance.now();
    if (e.button === 0) { this.leftMouseDown = true; if (!this.isBowHeld) this.attackQueued = true; }
    else if (e.button === 2) { this.rightMouseDown = true; }
  }

  private onMouseUp(e: PointerEvent): void {
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) { if (this.leftMouseDown && this.isBowHeld) this.bowReleaseQueued = true; this.leftMouseDown = false; }
    else if (e.button === 2) { this.rightMouseDown = false; }
  }

  private trackMouseAim(e: PointerEvent): void {
    if (e.pointerType !== "mouse" || (e.target as HTMLElement | null)?.closest(".ow-modal")) return;
    const msSinceTouch = performance.now() - this.lastTouchAtMs;
    if (msSinceTouch <= 500) return;
    if (isTouchInputActive()) {
      const prev = this.lastMouseMove;
      this.lastMouseMove = { x: e.clientX, y: e.clientY };
      if (!prev || !shouldSwitchToDesktopOnMouseMove({ dx: e.clientX - prev.x, dy: e.clientY - prev.y, msSinceTouch })) return;
      setActiveInputMode("desktop");
    }
    this.mouseClient = { x: e.clientX, y: e.clientY };
    this.mouseMovedAtMs = performance.now();
  }

  private startTouch(e: PointerEvent): void {
    if (e.pointerType !== "touch" || this.pointerId !== null || isUiTarget(e.target)) return;
    this.pointerId = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.touchStartMs = performance.now();
    this.touchMaxDist = 0;
    this.touchVector = { x: 0, y: 0 };
    this.stickEl.style.left = `${e.clientX}px`;
    this.stickEl.style.top = `${e.clientY}px`;
    this.stickEl.style.display = "block";
    this.knobEl.style.transform = "translate(-50%, -50%)";
  }

  private moveTouch(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const maxRadius = 46;
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const dist = Math.hypot(dx, dy);
    this.touchMaxDist = Math.max(this.touchMaxDist, dist);
    const clamped = Math.min(dist, maxRadius);
    const nx = dist > 2 ? dx / dist : 0;
    const ny = dist > 2 ? dy / dist : 0;
    this.knobEl.style.transform = `translate(calc(-50% + ${nx * clamped}px), calc(-50% + ${ny * clamped}px))`;
    const strength = clamped / maxRadius;
    const dz = COMBAT_TUNING.movement.joystickDeadzone;
    const analogSpeed = strength > dz ? 0.22 + ((strength - dz) / (1 - dz)) * 0.78 : 0;
    this.touchVector = analogSpeed > 0 ? { x: nx * analogSpeed, y: ny * analogSpeed } : { x: 0, y: 0 };
  }

  private endTouch(e: PointerEvent, completed: boolean): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.touchVector = { x: 0, y: 0 };
    this.stickEl.style.display = "none";
    if (!completed || !this.enabled) return;
    this.resolveTouchGesture(e);
  }

  private resolveTouchGesture(e: PointerEvent): void {
    const elapsed = performance.now() - this.touchStartMs;
    if (this.touchMaxDist < 14 && elapsed < 260) {
      this.callbacks.onWorldTap?.(e.clientX, e.clientY);
    }
  }
}