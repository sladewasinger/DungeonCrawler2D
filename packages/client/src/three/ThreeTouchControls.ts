/* eslint-disable max-lines -- input capture and release ownership stays in one controller. */
/** Owns touch-stick, aim-stick, and action control presentation for mobile play. */
import {
  inputModality,
  type InputModality,
  type InputModalityStore,
} from "../input/inputModality.js";
import { setTouchButtonPressed } from "./ThreeTouchActionButtons.js";
import { mountTouchControls } from "./ThreeTouchControlMount.js";
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
    mountTouchControls({
      layer: this.layer, movementZone: this.movementZone, stick: this.stick, knob: this.knob, aimStick: this.aimStick, aimKnob: this.aimKnob,
      beginStick: this.beginStick.bind(this), moveStick: this.moveStick.bind(this), endStick: this.endStick.bind(this), beginLook: this.beginLook.bind(this), moveLook: this.moveLook.bind(this), endLook: this.endLook.bind(this),
      queueJump: () => this.queueJump(), triggerAction: (action) => this.triggerAction(action), setInteractHeld: (held) => { this.state.interactHeld = held; }, setBlock: (held) => { this.state.block = held; }, setRun: (held) => { this.state.run = held; }, setJump: (held) => { this.state.jump = held; }, setJumpButton: (button) => { this.jumpButton = button; },
    });
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
