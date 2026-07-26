/** Owns touch-stick, aim-stick, and action control presentation for mobile play. */
import {
  inputModality,
  type InputModality,
  type InputModalityStore,
} from "../input/inputModality.js";
import { bindTouchActionButton, bindTouchHoldButton, bindTouchJumpButton, createTouchButton, setTouchButtonPressed } from "./ThreeTouchActionButtons.js";
import { ThreeTouchControlState } from "./ThreeTouchControlState.js";
import { pointerInside, releasePointerCapture } from "./ThreeTouchDom.js";
import { touchVector } from "./touchMath.js";

const STICK_RADIUS = 54;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export class ThreeTouchControls {
  private activeMode = false;
  private built = false;
  private readonly stopModality: () => void;
  private readonly state = new ThreeTouchControlState();
  private stickPointer: number | null = null; private lookPointer: number | null = null;
  private jumpPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 }; private lookOrigin = { x: 0, y: 0 };
  private readonly layer = document.createElement("div");
  private readonly movementZone = document.createElement("div");
  private readonly stick = document.createElement("div"); private readonly knob = document.createElement("div");
  private readonly aimStick = document.createElement("div"); private readonly aimKnob = document.createElement("div");
  private jumpButton: HTMLButtonElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    modality: InputModalityStore = inputModality,
  ) {
    this.stopModality = modality.subscribe((mode) => this.applyModality(mode));
    this.applyModality(modality.current);
  }

  get active(): boolean {
    return this.activeMode;
  }

  private build(): void {
    this.layer.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none;touch-action:none";
    this.mountStick();
    this.mountLookPad();
    this.mountButtons();
    this.built = true;
  }

  private applyModality(mode: InputModality): void {
    const active = mode === "touch";
    if (active === this.activeMode) return;
    this.activeMode = active;
    if (active) this.mount();
    else this.unmount();
  }

  private mount(): void {
    if (!this.built) this.build();
    this.root.append(this.layer);
    this.root.addEventListener("pointerdown", this.captureJump, true);
    this.root.addEventListener("pointerup", this.releaseCapturedJump, true);
    this.root.addEventListener("pointercancel", this.releaseCapturedJump, true);
  }

  private unmount(): void {
    this.releaseActiveCaptures();
    this.reset();
    this.root.removeEventListener("pointerdown", this.captureJump, true);
    this.root.removeEventListener("pointerup", this.releaseCapturedJump, true);
    this.root.removeEventListener("pointercancel", this.releaseCapturedJump, true);
    this.layer.remove();
  }

  read(seconds: number): { forward: number; right: number; jump: boolean; run: boolean; block: boolean; attack: boolean; interactPressed: boolean; interactHeld: boolean; throwItem: boolean; yaw: number; pitch: number } {
    return this.state.read(seconds);
  }

  consumeJumpPress(): boolean {
    return this.state.consumeJumpPress();
  }

  reset(): void {
    this.state.reset();
    this.stickPointer = null;
    this.lookPointer = null;
    this.jumpPointer = null;
    this.knob.style.transform = "";
    this.aimKnob.style.transform = "";
    this.resetStickPosition();
  }

  dispose(): void {
    this.stopModality();
    this.activeMode = false;
    this.unmount();
  }

  private releaseActiveCaptures(): void {
    releasePointerCapture(this.stick, this.stickPointer);
    releasePointerCapture(this.aimStick, this.lookPointer);
    releasePointerCapture(this.jumpButton, this.jumpPointer);
  }

  private mountStick(): void {
    this.stick.style.cssText = "position:absolute;left:24px;bottom:28px;width:108px;height:108px;border:1px solid #8a8fa9;border-radius:50%;background:rgba(28,29,45,.48);pointer-events:auto;touch-action:none";
    this.movementZone.style.cssText = "position:absolute;left:0;bottom:0;width:50%;height:50%;pointer-events:auto;touch-action:none";
    this.knob.style.cssText = "position:absolute;left:36px;top:36px;width:34px;height:34px;border:1px solid #dbd8cd;border-radius:50%;background:rgba(220,220,230,.18)";
    this.stick.append(this.knob);
    this.layer.append(this.movementZone, this.stick);
    this.movementZone.addEventListener("pointerdown", (event) => this.beginStick(event));
    this.stick.addEventListener("pointerdown", (event) => this.beginStick(event));
    this.stick.addEventListener("pointermove", (event) => this.moveStick(event));
    this.stick.addEventListener("pointerup", (event) => this.endStick(event));
    this.stick.addEventListener("pointercancel", (event) => this.endStick(event));
  }

  private mountLookPad(): void {
    this.aimStick.style.cssText = "position:absolute;right:24px;bottom:28px;width:108px;height:108px;border:1px solid #8a8fa9;border-radius:50%;background:rgba(28,29,45,.48);pointer-events:auto;touch-action:none";
    this.aimKnob.style.cssText = "position:absolute;left:36px;top:36px;width:34px;height:34px;border:1px solid #dbd8cd;border-radius:50%;background:rgba(220,220,230,.18)";
    this.aimStick.append(this.aimKnob);
    this.layer.append(this.aimStick);
    this.aimStick.addEventListener("pointerdown", (event) => this.beginLook(event));
    this.aimStick.addEventListener("pointermove", (event) => this.moveLook(event));
    this.aimStick.addEventListener("pointerup", (event) => this.endLook(event));
    this.aimStick.addEventListener("pointercancel", (event) => this.endLook(event));
  }

  private mountButtons(): void {
    const attack = createTouchButton("ATTACK", 148, 20);
    const jump = createTouchButton("JUMP", 214, 20);
    const interact = createTouchButton("USE", 181, 86);
    const throwItem = createTouchButton("THROW", 247, 86); const block = createTouchButton("BLOCK", 148, 86); const sprint = createTouchButton("SPRINT", 148, 152);
    bindTouchActionButton(attack, () => this.triggerAction("attack"));
    bindTouchHoldButton(
      interact,
      () => { this.state.interactPressed = true; },
      (held) => { this.state.interactHeld = held; },
    );
    bindTouchActionButton(throwItem, () => this.triggerAction("throw"));
    bindTouchHoldButton(block, () => {}, (held) => { this.state.block = held; }); bindTouchHoldButton(sprint, () => {}, (held) => { this.state.run = held; });
    bindTouchJumpButton(jump, () => this.queueJump(), (held) => { this.state.jump = held; });
    this.jumpButton = jump;
    this.layer.append(attack, jump, interact, throwItem, block, sprint);
  }

  private beginStick(event: PointerEvent): void {
    event.preventDefault();
    this.stickPointer = event.pointerId;
    this.moveStickTo(event.clientX, event.clientY);
    this.stickOrigin = { x: event.clientX, y: event.clientY };
    this.stick.setPointerCapture(event.pointerId);
  }

  private moveStick(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    const dx = clamp(event.clientX - this.stickOrigin.x, -STICK_RADIUS, STICK_RADIUS);
    const dy = clamp(event.clientY - this.stickOrigin.y, -STICK_RADIUS, STICK_RADIUS);
    this.state.movement = touchVector(dx, dy, STICK_RADIUS);
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private endStick(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.state.movement = { x: 0, z: 0 };
    this.knob.style.transform = "";
    this.resetStickPosition();
  }

  private beginLook(event: PointerEvent): void {
    this.lookPointer = event.pointerId;
    this.lookOrigin = { x: event.clientX, y: event.clientY };
    this.aimStick.setPointerCapture(event.pointerId);
  }

  private moveLook(event: PointerEvent): void {
    if (event.pointerId !== this.lookPointer) return;
    const dx = clamp(event.clientX - this.lookOrigin.x, -STICK_RADIUS, STICK_RADIUS);
    const dy = clamp(event.clientY - this.lookOrigin.y, -STICK_RADIUS, STICK_RADIUS);
    this.state.aim = touchVector(dx, dy, STICK_RADIUS);
    this.aimKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private endLook(event: PointerEvent): void {
    if (event.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
    this.state.aim = { x: 0, z: 0 };
    this.aimKnob.style.transform = "";
  }

  private queueJump(): void { this.state.jumpPressed = true; }

  private readonly captureJump = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || !this.jumpButton ||
      !pointerInside(this.jumpButton, event)) return;
    this.jumpPointer = event.pointerId;
    this.state.jump = true;
    this.queueJump();
    setTouchButtonPressed(this.jumpButton, true);
  };

  private readonly releaseCapturedJump = (event: PointerEvent): void => {
    if (event.pointerId !== this.jumpPointer) return;
    this.jumpPointer = null;
    this.state.jump = false;
    if (this.jumpButton) setTouchButtonPressed(this.jumpButton, false);
  };

  private triggerAction(action: "attack" | "throw"): void {
    if (action === "attack") this.state.attack = true;
    else this.state.throwItem = true;
  }

  private moveStickTo(clientX: number, clientY: number): void {
    const bounds = this.layer.getBoundingClientRect();
    const left = clamp(clientX - bounds.left - STICK_RADIUS, 8, Math.max(8, bounds.width / 2 - 8));
    const top = clamp(clientY - bounds.top - STICK_RADIUS, 8, Math.max(8, bounds.height - 116));
    this.stick.style.left = `${left}px`;
    this.stick.style.top = `${top}px`;
    this.stick.style.bottom = "auto";
  }

  private resetStickPosition(): void {
    this.stick.style.left = "24px";
    this.stick.style.top = "auto";
    this.stick.style.bottom = "28px";
  }
}
