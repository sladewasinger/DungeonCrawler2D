/** Keeps the first-person eye inside authoritative walkable space. */
export interface CameraSafetyWorld {
  isWalkable(x: number, z: number): boolean;
}

export interface PlanarPosition {
  x: number;
  z: number;
}

export const CAMERA_WALL_CLEARANCE = 0.08;

const walkableAt = (world: CameraSafetyWorld, point: PlanarPosition): boolean =>
  world.isWalkable(Math.floor(point.x), Math.floor(point.z));

const axisSafeCandidate = (
  world: CameraSafetyWorld,
  current: PlanarPosition,
  desired: PlanarPosition,
): PlanarPosition => {
  if (walkableAt(world, desired)) return desired;
  const xOnly = { x: desired.x, z: current.z };
  if (walkableAt(world, xOnly)) return xOnly;
  const zOnly = { x: current.x, z: desired.z };
  if (walkableAt(world, zOnly)) return zOnly;
  return current;
};

const clampAgainstWalls = (
  world: CameraSafetyWorld,
  point: PlanarPosition,
  clearance: number,
): PlanarPosition => {
  const tileX = Math.floor(point.x);
  const tileZ = Math.floor(point.z);
  const minX = world.isWalkable(tileX - 1, tileZ) ? point.x : tileX + clearance;
  const maxX = world.isWalkable(tileX + 1, tileZ) ? point.x : tileX + 1 - clearance;
  const minZ = world.isWalkable(tileX, tileZ - 1) ? point.z : tileZ + clearance;
  const maxZ = world.isWalkable(tileX, tileZ + 1) ? point.z : tileZ + 1 - clearance;
  return {
    x: Math.min(maxX, Math.max(minX, point.x)),
    z: Math.min(maxZ, Math.max(minZ, point.z)),
  };
};

export interface SafeCameraPositionInput {
  world: CameraSafetyWorld;
  current: PlanarPosition;
  desired: PlanarPosition;
  clearance?: number;
}

export const safeCameraPosition = ({
  world,
  current,
  desired,
  clearance = CAMERA_WALL_CLEARANCE,
}: SafeCameraPositionInput): PlanarPosition => {
  const candidate = axisSafeCandidate(world, current, desired);
  if (!walkableAt(world, candidate)) return current;
  return clampAgainstWalls(world, candidate, Math.max(0, clearance));
};
