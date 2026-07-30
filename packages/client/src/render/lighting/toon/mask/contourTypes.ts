export interface ToonMaskPoint {
  readonly x: number;
  readonly y: number;
}

export interface ToonMaskPath {
  readonly points: readonly ToonMaskPoint[];
}

export interface MaskOccupancy {
  readonly cells: ReadonlySet<string>;
  readonly elevations: ReadonlyMap<string, number | null>;
}

export interface BoundaryEdge {
  readonly from: ToonMaskPoint;
  readonly to: ToonMaskPoint;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function pointKey(point: ToonMaskPoint): string {
  return cellKey(point.x, point.y);
}

export function edgeKey(edge: BoundaryEdge): string {
  return `${pointKey(edge.from)}>${pointKey(edge.to)}`;
}

export function parseCellKey(key: string): ToonMaskPoint {
  const [x, y] = key.split(",").map(Number);
  return { x: x as number, y: y as number };
}

export function cross(left: ToonMaskPoint, right: ToonMaskPoint): number {
  return left.x * right.y - left.y * right.x;
}

export function signedTwiceArea(path: readonly ToonMaskPoint[]): number {
  return path.reduce((area, point, index) =>
    area + cross(point, path[(index + 1) % path.length] as ToonMaskPoint), 0);
}

export function samePoint(left: ToonMaskPoint, right: ToonMaskPoint): boolean {
  return left.x === right.x && left.y === right.y;
}

export function pathEdge(
  path: readonly ToonMaskPoint[],
  index: number,
): BoundaryEdge {
  return {
    from: path[index] as ToonMaskPoint,
    to: path[(index + 1) % path.length] as ToonMaskPoint,
  };
}
