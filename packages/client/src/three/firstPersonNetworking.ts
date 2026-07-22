/** Converts first-person movement into fixed-rate authoritative server input. */
import { TICK_DT, type MoveInput } from "@dc2d/engine";
import type { FirstPersonInput } from "./movement.js";

const normalized = (x: number, y: number) => {
  const length = Math.hypot(x, y);
  const scale = length > 1 ? 1 / length : 1;
  return {
    x: Math.abs(x * scale) < 1e-10 ? 0 : x * scale,
    y: Math.abs(y * scale) < 1e-10 ? 0 : y * scale,
  };
};

export const firstPersonMoveInput = (input: FirstPersonInput): MoveInput => {
  const forwardX = -Math.sin(input.yaw);
  const forwardY = -Math.cos(input.yaw);
  const rightX = Math.cos(input.yaw);
  const rightY = -Math.sin(input.yaw);
  const direction = normalized(
    forwardX * input.forward + rightX * input.right,
    forwardY * input.forward + rightY * input.right,
  );
  return {
    moveX: direction.x,
    moveY: direction.y,
    faceX: forwardX,
    faceY: forwardY,
    jump: input.jump,
    run: false,
  };
};

export const advanceInputClock = (elapsed: number, pending: number) => {
  const total = Math.max(0, elapsed) + pending;
  const ticks = Math.floor(total / TICK_DT);
  return { ticks, pending: total - ticks * TICK_DT };
};
