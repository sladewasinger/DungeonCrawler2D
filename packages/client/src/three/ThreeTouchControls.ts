/** Owns touch-stick, aim-stick, and action control presentation for mobile play. */
import { isTouchDevice } from "../input/touchDetect.js";
import { bindTouchActionButton, bindTouchJumpButton, createTouchButton, setTouchButtonPressed } from "./ThreeTouchActionButtons.js";
import { touchVector, type TouchVector } from "./touchMath.js";

const STICK_RADIUS = 54;
const AIM_TURN_SPEED = 2.4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export class ThreeTouchControls {
  readonly active = isTouchDevice();
  private movement: TouchVector = { x: 0, z: 0 };
  private aim: TouchVector = { x: 0, z: 0 };
  private jump = false;
  private jumpPressed = false;
  private attack = false;
  private interact = false;
  private throwItem = false;
  private yaw = 0;
  private pitch = 0;
  private stickPointer: number | null = null;
  private lookPointer: number | null = null;
  private jumpPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookOrigin = { x: 0, y: 0 };
  private readonly layer = document.createElement("div");
  private readonly movementZone = document.createElement("div");
  private readonly stick = document.createElement("div");
  private readonly knob = document.createElement("div");
  private readonly aimStick = document.createElement("div");
  private readonly aimKnob = document.createElement("div");
  private jumpButton: HTMLButtonElement | null = null;

  constructor(private readonly root: HTMLElement) {
    if (!this.active) return;
    this.layer.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none;touch-action:none";
    root.append(this.layer);
    this.mountStick();
    this.mountLookPad();
    this.mountButtons();
    root.addEventListener("pointerdown", this.captureJump, true);
    root.addEventListener("pointerup", this.releaseCapturedJump, true);
    root.addEventListener("pointercancel", this.releaseCapturedJump, true);
  }

  read(seconds: number): { forward: number; right: number; jump: boolean; attack: boolean; interact: boolean; throwItem: boolean; yaw: number; pitch: number } {
    const elapsed = clamp(seconds, 0, 0.05);
    this.yaw += -this.aim.x * AIM_TURN_SPEED * elapsed;
    this.pitch += this.aim.z * AIM_TURN_SPEED * elapsed;
    const result = {
      forward: this.movement.z,
      right: this.movement.x,
      jump: this.jump,
      attack: this.attack,
      interact: this.interact,
      throwItem: this.throwItem,
      yaw: this.yaw,
      pitch: this.pitch,
    };
    this.attack = false;
    this.interact = false;
    this.throwItem = false;
    this.yaw = 0;
    this.pitch = 0;
    return result;
  }

  consumeJumpPress(): boolean {
    const pressed = this.jumpPressed;
    this.jumpPressed = false;
    return pressed;
  }

  reset(): void {
    this.movement = { x: 0, z: 0 };
    this.aim = { x: 0, z: 0 };
    this.jump = false;
    this.jumpPressed = false;
    this.attack = false;
    this.interact = false;
    this.throwItem = false;
    this.yaw = 0;
    this.pitch = 0;
    this.stickPointer = null;
    this.lookPointer = null;
    this.jumpPointer = null;
    this.knob.style.transform = "";
    this.aimKnob.style.transform = "";
    this.resetStickPosition();
  }

  dispose(): void {
    if (!this.active) return;
    this.root.removeEventListener("pointerdown", this.captureJump, true);
    this.root.removeEventListener("pointerup", this.releaseCapturedJump, true);
    this.root.removeEventListener("pointercancel", this.releaseCapturedJump, true);
    this.layer.remove();
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
    const throwItem = createTouchButton("THROW", 247, 86);
    bindTouchActionButton(attack, () => this.triggerAction("attack"));
    bindTouchActionButton(interact, () => this.triggerAction("interact"));
    bindTouchActionButton(throwItem, () => this.triggerAction("throw"));
    bindTouchJumpButton(jump, () => this.queueJump(), (held) => { this.jump = held; });
    this.jumpButton = jump;
    this.layer.append(attack, jump, interact, throwItem);
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
    this.movement = touchVector(dx, dy, STICK_RADIUS);
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private endStick(event: PointerEvent): void {
    if (event.pointerId !== this.stickPointer) return;
    this.stickPointer = null;
    this.movement = { x: 0, z: 0 };
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
    this.aim = touchVector(dx, dy, STICK_RADIUS);
    this.aimKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  private endLook(event: PointerEvent): void {
    if (event.pointerId !== this.lookPointer) return;
    this.lookPointer = null;
    this.aim = { x: 0, z: 0 };
    this.aimKnob.style.transform = "";
  }

  private queueJump(): void { this.jumpPressed = true; }

  private readonly captureJump = (event: PointerEvent): void => {
    if (event.pointerType !== "touch" || !this.jumpButton || !this.isInsideJump(event)) return;
    this.jumpPointer = event.pointerId;
    this.jump = true;
    this.queueJump();
    setTouchButtonPressed(this.jumpButton, true);
  };

  private readonly releaseCapturedJump = (event: PointerEvent): void => {
    if (event.pointerId !== this.jumpPointer) return;
    this.jumpPointer = null;
    this.jump = false;
    if (this.jumpButton) setTouchButtonPressed(this.jumpButton, false);
  };

  private isInsideJump(event: PointerEvent): boolean {
    const bounds = this.jumpButton?.getBoundingClientRect();
    return bounds !== undefined && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  }

  private triggerAction(action: "attack" | "interact" | "throw"): void {
    if (action === "attack") this.attack = true;
    else if (action === "interact") this.interact = true;
    else this.throwItem = true;
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
