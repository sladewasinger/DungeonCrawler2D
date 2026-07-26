// Shared direction facts for stepped stair surfaces.

export const TREAD_COUNT = 4;

/** True when this direction's climb stacks treads along the Y axis (screen-horizontal lines). */
export function stacksVertically(direction: number): boolean {
  return direction === 0 || direction === 2;
}

/** True when this direction's high end sits at axisFrac 0 (north or west). */
export function highEndAtStart(direction: number): boolean {
  return direction === 0 || direction === 3;
}
