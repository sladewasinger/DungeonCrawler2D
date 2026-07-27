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
  run?: boolean;
  block?: boolean;
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

export interface FirstPersonStepRequest {
  state: FirstPersonState;
  input: FirstPersonInput;
  world: FirstPersonWorld;
  seconds: number;
  config?: FirstPersonConfig;
}

interface PlanarMovement {
  x: number;
  z: number;
}

interface EnterCheck {
  world: FirstPersonWorld;
  position: PlanarMovement;
  y: number;
  maxStepHeight: number;
}

export const stepFirstPerson = ({
  state,
  input,
  world,
  seconds,
  config = FIRST_PERSON_CONFIG,
}: FirstPersonStepRequest): FirstPersonState => {
  const dt = Math.min(Math.max(seconds, 0), 0.05);
  const position = stepPlanarPosition({ state, input, world, dt, config });
  return stepVerticalPosition({ state, input, world, position, dt, config });
};

interface ResolvedStepInput {
  state: FirstPersonState;
  input: FirstPersonInput;
  world: FirstPersonWorld;
  config: FirstPersonConfig;
  dt: number;
}

const stepPlanarPosition = ({ state, input, world, dt, config }: ResolvedStepInput): PlanarMovement => {
  const delta = movementDelta({ input, dt, walkSpeed: config.walkSpeed });
  const x = canEnter({ world, position: { x: state.x + delta.x, z: state.z }, y: state.y, maxStepHeight: config.maxStepHeight })
    ? state.x + delta.x
    : state.x;
  const z = canEnter({ world, position: { x, z: state.z + delta.z }, y: state.y, maxStepHeight: config.maxStepHeight })
    ? state.z + delta.z
    : state.z;
  return { x, z };
};

const movementDelta = ({ input, dt, walkSpeed }: { input: FirstPersonInput; dt: number; walkSpeed: number }): PlanarMovement => {
  const length = Math.hypot(input.forward, input.right);
  const scale = length > 1 ? 1 / length : 1;
  const forward = input.forward * scale;
  const right = input.right * scale;
  return {
    x: (-Math.sin(input.yaw) * forward + Math.cos(input.yaw) * right) * walkSpeed * dt,
    z: (-Math.cos(input.yaw) * forward - Math.sin(input.yaw) * right) * walkSpeed * dt,
  };
};

const canEnter = ({ world, position, y, maxStepHeight }: EnterCheck): boolean =>
  world.isWalkable(Math.floor(position.x), Math.floor(position.z)) &&
  world.groundAt(position.x, position.z) - y <= maxStepHeight;

const stepVerticalPosition = ({ state, input, world, position, dt, config }: ResolvedStepInput & { position: PlanarMovement }): FirstPersonState => {
  const launched = state.grounded && input.jump;
  const velocity = (launched ? config.jumpSpeed : state.verticalVelocity) - config.gravity * dt;
  const y = state.y + velocity * dt;
  const ground = world.groundAt(position.x, position.z);
  if (y > ground) return { ...position, y, verticalVelocity: velocity, grounded: false };
  return { ...position, y: ground, verticalVelocity: 0, grounded: true };
};
