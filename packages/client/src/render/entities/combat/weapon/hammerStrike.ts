export interface HammerStrikeInput {
  readonly screenX: number;
  readonly screenY: number;
  readonly attackAngleRad: number;
  readonly progress: number;
  readonly tilePx: number;
}

export interface HammerStrikeTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
  readonly behindWielder: boolean;
}

/** Presentation-only overhead path: rear shoulder, above the head, then ground impact. */
export function hammerStrikeTransform(input: HammerStrikeInput): HammerStrikeTransform {
  const progress = clampProgress(input.progress);
  const direction = {
    x: Math.cos(input.attackAngleRad),
    y: Math.sin(input.attackAngleRad),
  };
  const start = {
    x: input.screenX - direction.x * input.tilePx * 0.5,
    y: input.screenY - input.tilePx * 0.45 - direction.y * input.tilePx * 0.25,
  };
  const apex = {
    x: input.screenX,
    y: input.screenY - input.tilePx * 2,
  };
  const impact = {
    x: input.screenX + direction.x * input.tilePx * 0.9,
    y: input.screenY + direction.y * input.tilePx * 0.55 + input.tilePx * 0.1,
  };
  const curve = { start, control: apex, end: impact };
  const point = quadraticPoint(curve, progress);
  const tangent = quadraticTangent(curve, progress);
  return {
    ...point,
    rotation: Math.atan2(tangent.y, tangent.x),
    scale: 1 + Math.sin(Math.PI * progress) * 0.18,
    behindWielder: progress < 0.28,
  };
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface QuadraticCurve {
  readonly start: Point;
  readonly control: Point;
  readonly end: Point;
}

function quadraticPoint(curve: QuadraticCurve, progress: number): Point {
  const { start, control, end } = curve;
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
    y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
  };
}

function quadraticTangent(curve: QuadraticCurve, progress: number): Point {
  const { start, control, end } = curve;
  return {
    x: 2 * (1 - progress) * (control.x - start.x) + 2 * progress * (end.x - control.x),
    y: 2 * (1 - progress) * (control.y - start.y) + 2 * progress * (end.y - control.y),
  };
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress));
}
