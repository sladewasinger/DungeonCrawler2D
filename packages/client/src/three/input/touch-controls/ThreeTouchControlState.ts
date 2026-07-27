import type { TouchVector } from "./touchMath.js";

const AIM_TURN_SPEED = 2.4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export interface ThreeTouchSample {
  forward: number;
  right: number;
  jump: boolean;
  run: boolean;
  block: boolean;
  attack: boolean;
  interactPressed: boolean;
  interactHeld: boolean;
  throwItem: boolean;
  yaw: number;
  pitch: number;
}

export class ThreeTouchControlState {
  movement: TouchVector = { x: 0, z: 0 };
  aim: TouchVector = { x: 0, z: 0 };
  jump = false;
  jumpPressed = false;
  attack = false;
  interactPressed = false;
  interactHeld = false;
  throwItem = false;
  run = false;
  block = false;
  private yaw = 0;
  private pitch = 0;

  read(seconds: number): ThreeTouchSample {
    const elapsed = clamp(seconds, 0, 0.05);
    this.yaw += -this.aim.x * AIM_TURN_SPEED * elapsed;
    this.pitch += this.aim.z * AIM_TURN_SPEED * elapsed;
    const result = {
      forward: this.movement.z,
      right: this.movement.x,
      jump: this.jump,
      run: this.run,
      block: this.block,
      attack: this.attack,
      interactPressed: this.interactPressed,
      interactHeld: this.interactHeld,
      throwItem: this.throwItem,
      yaw: this.yaw,
      pitch: this.pitch,
    };
    this.attack = false;
    this.interactPressed = false;
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
    this.interactPressed = false;
    this.interactHeld = false;
    this.throwItem = false;
    this.run = false;
    this.block = false;
    this.yaw = 0;
    this.pitch = 0;
  }
}
