export const SIGHT_HEIGHT_EPSILON = 1e-6;

export interface SightElevation {
  readonly lastHeight: number;
  readonly direction: number;
}

export function advanceSightElevation(
  current: SightElevation,
  height: number,
): SightElevation | null {
  const direction = elevationDirection(current.lastHeight, height);
  if (reversesElevation(current.direction, direction)) return null;
  return {
    lastHeight: height,
    direction: direction === 0 ? current.direction : direction,
  };
}

function elevationDirection(from: number, to: number): number {
  if (Math.abs(to - from) <= SIGHT_HEIGHT_EPSILON) return 0;
  return Math.sign(to - from);
}

function reversesElevation(previous: number, next: number): boolean {
  return previous !== 0 && next !== 0 && previous !== next;
}
