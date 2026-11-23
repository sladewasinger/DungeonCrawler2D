/** Touch joystick + combat buttons, swipe-to-roll, world tap, desktop WASD, and shortcuts. */
import { COMBAT_TUNING } from "@dc2d/engine";
import {
  HOTBAR_DIGIT_MAP, createJoystickDom, createJumpButton, isEditingText, isGuardedBrowserCombo, isUiTarget,
} from "./inputHelpers.js";
import { MobileCombatControls } from "./mobileCombatControls.js";

export interface InputCallbacks {
  readonly onToggleTorch: () => void;
  readonly onZoom: (factor: number) => void;
  readonly onSelectHotbar: (slot: number) => void;
  readonly onToggleInventory: () => void;
  readonly onToggleCrafting: () => void;
  readonly onToggleCharacter: () => void;
  readonly onToggleMap?: () => void;
  readonly onInteract?: () => void;
  readonly onWorldTap?: (clientX: number, clientY: number) => void;
  readonly onClosePanels: () => void;
}

export interface CombatInputsFrame {
  readonly attack: boolean;
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

export class InputController {
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private touchVector = { x: 0, y: 0 };
  private mouseClient: { x: number; y: number } | null = null;
  private mouseMovedAtMs = 0;
  private touchStartMs = 0;
  private touchMaxDist = 0;
  private jumpQueued = false;
  private dodgeQueued = false;
  private dodgeDir: { readonly x: number; readonly y: number } | undefined;
  private crouching = false;
  private throwPebbleQueued = false;
  private interactQueued = false;
  private attackQueued = false;
  private bowReleaseQueued = false;
  private leftMouseDown = false;
  private rightMouseDown = false;
  private isBowHeld = false;
  private hasShield = false;
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
    const jumpBtn = createJumpButton(() => { this.jumpQueued = true; });
    host.append(ring, jumpBtn);
    this.mobileCombat = new MobileCombatControls(host, () => callbacks.onToggleMap?.());
    this.bindKeyboard(callbacks);
    this.bindPointer(host, callbacks);
  }

  setGearState(gear: { readonly heldItem: string | null; readonly hasShield: boolean }): void {
    this.isBowHeld = gear.heldItem === "bow";
    this.hasShield = gear.hasShield;
    this.mobileCombat.setGear(gear);
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; if (!enabled) this.resetHeldInputs(); }
  queueInteract(): void { this.interactQueued = true; }
  consumeJump(): boolean { const fired = this.jumpQueued; this.jumpQueued = false; return fired; }

  private resolveBowDraw(mobBowDraw: boolean): boolean {
    return mobBowDraw || (this.isBowHeld && this.leftMouseDown);
  }

  private resolveDodgeDir(): { readonly x: number; readonly y: number } | undefined {
    return this.dodgeQueued ? this.dodgeDir : undefined;
  }

  consumeCombat(): CombatInputsFrame {
    const mob = this.mobileCombat.consumeState();
    const dodge = this.dodgeQueued || mob.dodge;
    const attack = this.attackQueued || mob.attack;
    if (this.shouldCancelCrouch(dodge, attack)) this.syncCrouch(false);
    const out: CombatInputsFrame = {
      attack,
      bowDraw: this.resolveBowDraw(mob.bowDraw),
      bowRelease: this.bowReleaseQueued || mob.bowRelease,
      block: this.isBlockHeld(mob.block),
      dodge,
      dodgeDir: this.resolveDodgeDir(),
      crouch: this.crouching || mob.crouch,
      throwPebble: this.throwPebbleQueued,
      interact: this.interactQueued,
      mobileAim: mob.aim,
    };
    this.clearQueuedCombat();
    return out;
  }

  private shouldCancelCrouch(dodge: boolean, attack: boolean): boolean {
    return dodge || attack || this.down("ShiftLeft", "ShiftRight");
  }

  private syncCrouch(next: boolean): void {
    this.crouching = next;
    this.mobileCombat.setCrouching(next);
  }

  private isBlockHeld(mobileBlock: boolean): boolean {
    return this.hasShield && (this.rightMouseDown || mobileBlock);
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
    return this.mouseClient ? { x: this.mouseClient.x, y: this.mouseClient.y, recent: nowMs - this.mouseMovedAtMs < 1500 } : null;
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
      this.keys.add(e.code);
      if (!e.repeat) this.handleShortcut(e, callbacks);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.resetHeldInputs());
  }

  private resetHeldInputs(): void { this.keys.clear(); this.leftMouseDown = false; this.rightMouseDown = false; }

  private handleShortcut(e: KeyboardEvent, callbacks: InputCallbacks): void {
    const hotbarIdx = HOTBAR_DIGIT_MAP[e.code];
    if (hotbarIdx !== undefined) { callbacks.onSelectHotbar(hotbarIdx); return; }
    if (e.code === "Tab") { e.preventDefault(); callbacks.onToggleInventory(); return; }
    if (e.code === "Space") {
      e.preventDefault();
      this.jumpQueued = true;
      this.syncCrouch(false);
      return;
    }
    if (e.code === "ControlLeft" || e.code === "ControlRight") { this.dodgeQueued = true; return; }
    const actions: Readonly<Record<string, () => void>> = {
      KeyE: () => { if (!callbacks.onInteract) this.interactQueued = true; callbacks.onInteract?.(); },
      KeyX: () => this.syncCrouch(!this.crouching),
      KeyQ: () => { this.throwPebbleQueued = true; },
      KeyC: callbacks.onToggleCrafting,
      KeyH: callbacks.onToggleCharacter,
      KeyF: callbacks.onToggleTorch,
      KeyM: () => { callbacks.onToggleMap?.(); },
      Escape: callbacks.onClosePanels,
    };
    actions[e.code]?.();
  }

  private bindPointer(host: HTMLElement, callbacks: InputCallbacks): void {
    host.addEventListener("wheel", (e) => { if (!this.enabled) return; e.preventDefault(); callbacks.onZoom(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    host.addEventListener("contextmenu", (e) => { if (this.enabled && !isUiTarget(e.target)) e.preventDefault(); });
    host.addEventListener("pointerdown", (e) => { if (!this.enabled) return; this.startTouch(e); this.onMouseDown(e); });
    host.addEventListener("pointermove", (e) => { this.moveTouch(e); this.trackMouseAim(e); });
    host.addEventListener("pointerup", (e) => { this.endTouch(e, true); this.onMouseUp(e); });
    host.addEventListener("pointercancel", (e) => { this.endTouch(e, false); this.onMouseUp(e); });
  }

  private onMouseDown(e: PointerEvent): void {
    if (e.pointerType !== "mouse" || isUiTarget(e.target)) return;
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
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const dist = Math.hypot(dx, dy);
    if (this.touchMaxDist < 14 && elapsed < 260) { this.callbacks.onWorldTap?.(e.clientX, e.clientY); return; }
    if (this.origin.x <= window.innerWidth * 0.58 && dist >= 34 && elapsed <= 260) {
      this.dodgeQueued = true;
      this.dodgeDir = { x: dx / dist, y: dy / dist };
    }
  }
}