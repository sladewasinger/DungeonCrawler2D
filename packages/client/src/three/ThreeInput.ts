/** Owns keyboard, mouse, and touch input sampling for the first-person renderer. */
import type { FirstPersonInput } from "./movement.js";
import { ThreeTouchControls } from "./ThreeTouchControls.js";
import { GiveUpGesture } from "../input/giveUp.js";

const LOOK_LIMIT = 1.42;
const MOUSE_SENSITIVITY = 0.0024;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const editingText = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const ignorePointerLockFailure = () => undefined;

export interface ThreeInputSample {
  input: FirstPersonInput;
  yaw: number;
  pitch: number;
  mouseCaptured: boolean;
  attack: boolean;
  interact: boolean;
  throwItem: boolean;
  giveUp: boolean;
}

export class ThreeInput {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly giveUp = new GiveUpGesture();
  private readonly touch: ThreeTouchControls;
  private yaw = Math.PI;
  private pitch = -0.08;

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
  }

  sample(elapsed: number): ThreeInputSample {
    const touch = this.touch.read(elapsed);
    this.yaw += touch.yaw;
    this.pitch = clamp(this.pitch + touch.pitch, -LOOK_LIMIT, LOOK_LIMIT);
    return {
      input: {
        forward: this.axis("KeyW", "KeyS") + touch.forward,
        right: this.axis("KeyD", "KeyA") + touch.right,
        jump: this.held.has("Space") || touch.jump,
        yaw: this.yaw,
      },
      yaw: this.yaw,
      pitch: this.pitch,
      mouseCaptured: document.pointerLockElement === this.canvas,
      attack: touch.attack,
      interact: touch.interact || this.consumePress("KeyE"),
      throwItem: touch.throwItem || this.consumePress("KeyG"),
      giveUp: this.giveUp.poll(true, performance.now()),
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
    this.touch.dispose();
  }

  focusGame(): void {
    this.canvas.focus({ preventScroll: true });
  }

  consumeJumpPress(): boolean {
    return this.touch.consumeJumpPress();
  }

  private axis(positive: string, negative: string): number {
    return Number(this.held.has(positive)) - Number(this.held.has(negative));
  }

  private consumePress(code: string): boolean {
    const pressed = this.pressed.delete(code);
    return pressed;
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (editingText(event.target)) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "KeyE", "KeyG", "KeyK"].includes(event.code)) {
      event.preventDefault();
    }
    if (!this.held.has(event.code)) this.pressed.add(event.code);
    this.held.add(event.code);
    if (event.code === "KeyK") this.giveUp.begin(true, performance.now());
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.held.delete(event.code);
    if (event.code === "KeyK") this.giveUp.end(performance.now());
  };

  private readonly reset = () => {
    this.held.clear();
    this.pressed.clear();
    this.giveUp.end(performance.now());
    this.touch.reset();
  };

  private readonly resetWhenHidden = () => {
    if (document.hidden) this.reset();
  };

  private readonly resetWhenPointerReleased = () => {
    if (document.pointerLockElement !== this.canvas) this.reset();
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= event.movementX * MOUSE_SENSITIVITY;
    this.pitch = clamp(this.pitch - event.movementY * MOUSE_SENSITIVITY, -LOOK_LIMIT, LOOK_LIMIT);
  };

  private readonly capturePointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || document.pointerLockElement === this.canvas) return;
    void this.canvas.requestPointerLock().catch(ignorePointerLockFailure);
  };
}
