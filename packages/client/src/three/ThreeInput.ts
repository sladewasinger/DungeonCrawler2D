/** Owns keyboard, mouse, and touch input sampling for the first-person renderer. */
import { ThreeTouchControls } from "./ThreeTouchControls.js";
import { clampInputValue, normalizedYaw, safeMouseDelta } from "./ThreeInputMath.js";
import { blockedInputSample, type ThreeInputSample } from "./ThreeInputTypes.js";

export type { ThreeInputSample } from "./ThreeInputTypes.js";
export { normalizedYaw, safeMouseDelta } from "./ThreeInputMath.js";

const LOOK_LIMIT = 1.42;
const MOUSE_SENSITIVITY = 0.0024;

const editingText = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const inventoryOwnsEvent = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-inventory-workspace]") !== null;

const ignorePointerLockFailure = () => undefined;


export class ThreeInput {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly touch: ThreeTouchControls;
  private yaw = Math.PI;
  private pitch = -0.08;
  private mouseAttack = false;
  private mouseBlocking = false;
  private gameplayBlocked = () => false;

  constructor(root: HTMLElement, private readonly canvas: HTMLCanvasElement) {
    canvas.tabIndex = -1;
    this.touch = new ThreeTouchControls(root);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("blur", this.reset);
    document.addEventListener("visibilitychange", this.resetWhenHidden);
    document.addEventListener("pointerlockchange", this.resetWhenPointerReleased);
    canvas.addEventListener("pointerdown", this.capturePointer);
    canvas.addEventListener("pointerup", this.releasePointer);
    canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  sample(elapsed: number): ThreeInputSample {
    if (this.gameplayBlocked()) {
      this.reset();
      return blockedInputSample(this.yaw, this.pitch);
    }
    return this.activeSample(this.readTouch(elapsed));
  }

  private readTouch(elapsed: number): ReturnType<ThreeTouchControls["read"]> {
    const touch = this.touch.read(elapsed);
    this.yaw = normalizedYaw(this.yaw + touch.yaw);
    this.pitch = clampInputValue(this.pitch + touch.pitch, -LOOK_LIMIT, LOOK_LIMIT);
    return touch;
  }

  private activeSample(touch: ReturnType<ThreeTouchControls["read"]>): ThreeInputSample {
    return {
      input: this.activeMovement(touch),
      yaw: this.yaw,
      pitch: this.pitch,
      mouseCaptured: document.pointerLockElement === this.canvas,
      ...this.activeActions(touch),
    };
  }

  private activeMovement(touch: ReturnType<ThreeTouchControls["read"]>): ThreeInputSample["input"] {
    return {
      forward: this.axis("KeyW", "KeyS") + touch.forward,
      right: this.axis("KeyD", "KeyA") + touch.right,
      jump: this.held.has("Space") || touch.jump,
      yaw: this.yaw,
      run: this.held.has("ShiftLeft") || this.held.has("ShiftRight") || touch.run,
      block: this.mouseBlocking || touch.block,
    };
  }

  private activeActions(touch: ReturnType<ThreeTouchControls["read"]>): Omit<ThreeInputSample, "input" | "yaw" | "pitch" | "mouseCaptured"> {
    return {
      attack: this.consumeMouseAttack() || touch.attack,
      interactPressed: touch.interactPressed || this.consumePress("KeyE"),
      interactHeld: touch.interactHeld || this.held.has("KeyE"),
      throwItem: touch.throwItem || this.consumePress("KeyG"),
      bandageOther: this.consumePress("KeyF"),
    };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("blur", this.reset);
    document.removeEventListener("visibilitychange", this.resetWhenHidden);
    document.removeEventListener("pointerlockchange", this.resetWhenPointerReleased);
    this.canvas.removeEventListener("pointerdown", this.capturePointer);
    this.canvas.removeEventListener("pointerup", this.releasePointer);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
    this.touch.dispose();
  }

  focusGame(): void {
    this.canvas.focus({ preventScroll: true });
  }

  setGameplayBlocked(blocked: () => boolean): void {
    this.gameplayBlocked = blocked;
  }

  consumeJumpPress(): boolean {
    return this.touch.consumeJumpPress();
  }

  private axis(positive: string, negative: string): number { return Number(this.held.has(positive)) - Number(this.held.has(negative)); }

  private consumePress(code: string): boolean {
    const pressed = this.pressed.delete(code);
    return pressed;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.gameplayBlocked() || editingText(event.target) ||
      inventoryOwnsEvent(event.target)) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyE", "KeyF", "KeyG"].includes(event.code)) {
      event.preventDefault();
    }
    if (!this.held.has(event.code)) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => { this.held.delete(event.code); };

  private readonly reset = () => {
    this.held.clear();
    this.pressed.clear();
    this.touch.reset();
    this.mouseAttack = false;
    this.mouseBlocking = false;
  };

  private readonly resetWhenHidden = () => { if (document.hidden) this.reset(); };

  private readonly resetWhenPointerReleased = () => { if (document.pointerLockElement !== this.canvas) this.reset(); };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw = normalizedYaw(
      this.yaw - safeMouseDelta(event.movementX) * MOUSE_SENSITIVITY,
    );
    this.pitch = clampInputValue(
      this.pitch - safeMouseDelta(event.movementY) * MOUSE_SENSITIVITY,
      -LOOK_LIMIT,
      LOOK_LIMIT,
    );
  };

  private readonly capturePointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock().catch(ignorePointerLockFailure);
      return;
    }
    if (event.button === 0) this.mouseAttack = true;
    if (event.button === 2) this.mouseBlocking = true;
  };

  private readonly releasePointer = (event: PointerEvent) => {
    if (event.button === 2) this.mouseBlocking = false;
  };

  private readonly preventContextMenu = (event: Event) => event.preventDefault();

  private consumeMouseAttack(): boolean {
    const attack = this.mouseAttack;
    this.mouseAttack = false;
    return attack;
  }
}
