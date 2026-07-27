const MAX_MOUSE_DELTA = 160;
const POINTER_LOCK_SPIKE_DELTA = 500;
const FULL_TURN = Math.PI * 2;

export const clampInputValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const safeMouseDelta = (value: number): number => {
  if (!Number.isFinite(value) || Math.abs(value) > POINTER_LOCK_SPIKE_DELTA) return 0;
  return clampInputValue(value, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
};

export const normalizedYaw = (value: number): number =>
  ((value % FULL_TURN) + FULL_TURN) % FULL_TURN;
