/** Pure, north-up/screen-bearing projection math shared by the HUD minimap. */

export type MinimapMarkerKind =
  | "self"
  | "player"
  | "party"
  | "enemy";

export interface MinimapProjectionInput {
  readonly dx: number;
  readonly dy: number;
  readonly bearingDeg: number;
  readonly rangeTiles: number;
  readonly radiusPx: number;
  readonly edgePaddingPx?: number;
}

export interface MinimapPointProjection {
  readonly x: number;
  readonly y: number;
  readonly distanceTiles: number;
  readonly inside: boolean;
  readonly angleRad: number;
}

export const projectMinimapPoint = (
  input: MinimapProjectionInput,
): MinimapPointProjection => {
  const { dx, dy, bearingDeg, rangeTiles, radiusPx } = input;
  const distanceTiles = Math.hypot(dx, dy);
  const angleRad = screenAngle({ dx, dy, bearingDeg });
  const maxRadius = Math.max(0, radiusPx - (input.edgePaddingPx ?? 0));
  const inside = distanceTiles <= Math.max(0, rangeTiles);
  const projectedRadius = inside
    ? maxRadius * distanceTiles / Math.max(1, rangeTiles)
    : maxRadius;
  const x = Math.sin(angleRad) * projectedRadius;
  const y = -Math.cos(angleRad) * projectedRadius;
  return {
    x: zeroNearOrigin(x),
    y: zeroNearOrigin(y),
    distanceTiles,
    inside,
    angleRad,
  };
};

const zeroNearOrigin = (value: number): number => Math.abs(value) < 1e-10 ? 0 : value;

interface ScreenAngleInput {
  readonly dx: number;
  readonly dy: number;
  readonly bearingDeg: number;
}

const screenAngle = ({ dx, dy, bearingDeg }: ScreenAngleInput): number =>
  (bearingDeg + (Math.atan2(dx, -dy) * 180) / Math.PI) * Math.PI / 180;

export const minimapMarkerColor = (kind: MinimapMarkerKind): string => {
  if (kind === "enemy") return "#ef5350";
  if (kind === "party") return "#56d98b";
  if (kind === "self") return "#f2f0eb";
  return "#aeb4c5";
};
