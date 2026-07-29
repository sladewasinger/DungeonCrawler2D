/** Owns pure touch-vector and touch-look calculations. */
export interface TouchVector {
  x: number;
  z: number;
}

export const touchVector = (dx: number, dy: number, radius: number): TouchVector => {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || radius <= 0) return { x: 0, z: 0 };
  const magnitude = Math.min(1, distance / radius);
  return { x: normalizeZero((dx / distance) * magnitude), z: normalizeZero((-dy / distance) * magnitude) };
};

export const touchLookDelta = (dx: number, dy: number, sensitivity: number) => ({ yaw: -dx * sensitivity, pitch: -dy * sensitivity });

const normalizeZero = (value: number) => (Object.is(value, -0) ? 0 : value);
