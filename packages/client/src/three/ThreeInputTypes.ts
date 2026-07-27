import type { FirstPersonInput } from "./movement.js";

export interface ThreeInputSample {
  input: FirstPersonInput;
  yaw: number;
  pitch: number;
  mouseCaptured: boolean;
  attack: boolean;
  interactPressed: boolean;
  interactHeld: boolean;
  throwItem: boolean;
  bandageOther: boolean;
}

export const blockedInputSample = (yaw: number, pitch: number): ThreeInputSample => ({
  input: {
    forward: 0,
    right: 0,
    jump: false,
    yaw,
    run: false,
    block: false,
  },
  yaw,
  pitch,
  mouseCaptured: false,
  attack: false,
  interactPressed: false,
  interactHeld: false,
  throwItem: false,
  bandageOther: false,
});
