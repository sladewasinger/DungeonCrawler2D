const FULL_CIRCLE_RADIANS = Math.PI * 2;
const ANGLE_EPSILON = 1e-9;

export interface AngularShadowCell {
  readonly x: number;
  readonly y: number;
}

interface AngularRange {
  start: number;
  end: number;
}

/** Maintains merged angular occlusion intervals for one visibility sweep. */
export class AngularShadowField {
  private readonly shadows: AngularRange[] = [];

  obscures(
    origin: AngularShadowCell,
    cell: AngularShadowCell,
  ): boolean {
    const angle = centerAngle(origin, cell);
    return this.shadows.some((shadow) =>
      shadow.start <= angle + ANGLE_EPSILON &&
      shadow.end >= angle - ANGLE_EPSILON);
  }

  add(
    origin: AngularShadowCell,
    cell: AngularShadowCell,
  ): void {
    for (const range of angularRanges(origin, cell)) {
      addAngularShadow(this.shadows, range);
    }
  }

  coversAll(): boolean {
    const shadow = this.shadows[0];
    return this.shadows.length === 1 &&
      (shadow?.start ?? Infinity) <= ANGLE_EPSILON &&
      (shadow?.end ?? -Infinity) >=
        FULL_CIRCLE_RADIANS - ANGLE_EPSILON;
  }
}

function angularRanges(
  origin: AngularShadowCell,
  cell: AngularShadowCell,
): readonly AngularRange[] {
  const centerX = origin.x + 0.5;
  const centerY = origin.y + 0.5;
  const angles = [
    normalizedAngle(cell.x - centerX, cell.y - centerY),
    normalizedAngle(cell.x + 1 - centerX, cell.y - centerY),
    normalizedAngle(cell.x - centerX, cell.y + 1 - centerY),
    normalizedAngle(cell.x + 1 - centerX, cell.y + 1 - centerY),
  ].sort((left, right) => left - right);
  const gap = largestAngularGapIndex(angles);
  const start = angles[(gap + 1) % angles.length] ?? 0;
  let end = angles[gap] ?? start;
  if (end < start) end += FULL_CIRCLE_RADIANS;
  if (end <= FULL_CIRCLE_RADIANS) return [{ start, end }];
  return [
    { start, end: FULL_CIRCLE_RADIANS },
    { start: 0, end: end - FULL_CIRCLE_RADIANS },
  ];
}

function largestAngularGapIndex(angles: readonly number[]): number {
  let largestIndex = 0;
  let largestGap = -Infinity;
  for (let index = 0; index < angles.length; index += 1) {
    const current = angles[index] ?? 0;
    const next = angles[(index + 1) % angles.length] ?? current;
    const gap = next > current
      ? next - current
      : next + FULL_CIRCLE_RADIANS - current;
    if (gap > largestGap) {
      largestGap = gap;
      largestIndex = index;
    }
  }
  return largestIndex;
}

function centerAngle(
  origin: AngularShadowCell,
  cell: AngularShadowCell,
): number {
  return normalizedAngle(cell.x - origin.x, cell.y - origin.y);
}

function normalizedAngle(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx);
  return angle < 0 ? angle + FULL_CIRCLE_RADIANS : angle;
}

function addAngularShadow(
  shadows: AngularRange[],
  incoming: AngularRange,
): void {
  let start = incoming.start;
  let end = incoming.end;
  let index = shadows.findIndex((shadow) =>
    shadow.end + ANGLE_EPSILON >= start);
  if (index < 0) {
    shadows.push({ start, end });
    return;
  }
  const insertion = index;
  while (shadowOverlaps(shadows[index], end)) {
    const shadow = shadows[index];
    if (shadow) {
      start = Math.min(start, shadow.start);
      end = Math.max(end, shadow.end);
    }
    index += 1;
  }
  shadows.splice(insertion, index - insertion, { start, end });
}

function shadowOverlaps(
  shadow: AngularRange | undefined,
  end: number,
): boolean {
  return Boolean(shadow && shadow.start <= end + ANGLE_EPSILON);
}
