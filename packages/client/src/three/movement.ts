/** Owns pure first-person movement, jumping, and elevation-entry rules. */
import { MOVE_SPEED } from "@dc2d/engine";

export interface FirstPersonWorld {
  isWalkable(x: number, z: number): boolean;
  groundAt(x: number, z: number): number;
}

export interface FirstPersonState {
  x: number;
  y: number;
  z: number;
  verticalVelocity: number;
  grounded: boolean;
}

export interface FirstPersonInput {
  forward: number;
  right: number;
  jump: boolean;
  yaw: number;
}

export interface FirstPersonConfig {
  walkSpeed: number;
  jumpSpeed: number;
  gravity: number;
  maxStepHeight: number;
}

export const FIRST_PERSON_CONFIG: FirstPersonConfig = {
  walkSpeed: MOVE_SPEED,
  jumpSpeed: 5.7,
  gravity: 18,
  maxStepHeight: 0.5,
};

const length = (x: number, z: number) => Math.hypot(x, z);

const canEnter = (world: FirstPersonWorld, x: number, z: number, y: number, maxStepHeight: number) => {
  if (!world.isWalkable(Math.floor(x), Math.floor(z))) return false;
  return world.groundAt(x, z) - y <= maxStepHeight;
};

export const stepFirstPerson = (
  state: FirstPersonState,
  input: FirstPersonInput,
  world: FirstPersonWorld,
  seconds: number,
  config: FirstPersonConfig = FIRST_PERSON_CONFIG,
): FirstPersonState => {
  const dt = Math.min(Math.max(seconds, 0), 0.05);
  const directionLength = length(input.forward, input.right);
  const forward = directionLength > 1 ? input.forward / directionLength : input.forward;
  const right = directionLength > 1 ? input.right / directionLength : input.right;
  const forwardX = -Math.sin(input.yaw);
  const forwardZ = -Math.cos(input.yaw);
  const rightX = Math.cos(input.yaw);
  const rightZ = -Math.sin(input.yaw);
  const dx = (forwardX * forward + rightX * right) * config.walkSpeed * dt;
  const dz = (forwardZ * forward + rightZ * right) * config.walkSpeed * dt;
  let x = state.x;
  let z = state.z;
  let y = state.y;
  let verticalVelocity = state.verticalVelocity;
  let grounded = state.grounded;

  if (canEnter(world, x + dx, z, y, config.maxStepHeight)) x += dx;
  if (canEnter(world, x, z + dz, y, config.maxStepHeight)) z += dz;
  const ground = world.groundAt(x, z);

  if (grounded && input.jump) {
    verticalVelocity = config.jumpSpeed;
    grounded = false;
  }

  verticalVelocity -= config.gravity * dt;
  y += verticalVelocity * dt;

  if (y <= ground) {
    y = ground;
    verticalVelocity = 0;
    grounded = true;
  }

  return { x, y, z, verticalVelocity, grounded };
};
