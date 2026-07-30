import {
  cellKey,
  edgeKey,
  parseCellKey,
  pointKey,
  type BoundaryEdge,
  type ToonMaskPoint,
} from "./contourTypes.js";

export function traceMaskBoundaryPaths(
  cells: ReadonlySet<string>,
): ToonMaskPoint[][] {
  const edges = boundaryEdges(cells);
  const outgoing = edgesByStart(edges);
  const visited = new Set<string>();
  return edges.flatMap((edge) => traceBoundaryPath(edge, outgoing, visited));
}

function boundaryEdges(cells: ReadonlySet<string>): BoundaryEdge[] {
  const edges: BoundaryEdge[] = [];
  for (const key of cells) appendCellBoundaryEdges({ edges, cells, key });
  return edges;
}

function appendCellBoundaryEdges(request: {
  readonly edges: BoundaryEdge[];
  readonly cells: ReadonlySet<string>;
  readonly key: string;
}): void {
  const { x, y } = parseCellKey(request.key);
  appendExposedEdge({ ...request, from: { x, y }, to: { x: x + 1, y }, neighbor: { x, y: y - 1 } });
  appendExposedEdge({ ...request, from: { x: x + 1, y }, to: { x: x + 1, y: y + 1 }, neighbor: { x: x + 1, y } });
  appendExposedEdge({ ...request, from: { x: x + 1, y: y + 1 }, to: { x, y: y + 1 }, neighbor: { x, y: y + 1 } });
  appendExposedEdge({ ...request, from: { x, y: y + 1 }, to: { x, y }, neighbor: { x: x - 1, y } });
}

function appendExposedEdge(request: {
  readonly edges: BoundaryEdge[];
  readonly cells: ReadonlySet<string>;
  readonly from: ToonMaskPoint;
  readonly to: ToonMaskPoint;
  readonly neighbor: ToonMaskPoint;
}): void {
  if (request.cells.has(cellKey(request.neighbor.x, request.neighbor.y))) return;
  request.edges.push({ from: request.from, to: request.to });
}

function edgesByStart(
  edges: readonly BoundaryEdge[],
): Map<string, BoundaryEdge[]> {
  const outgoing = new Map<string, BoundaryEdge[]>();
  for (const edge of edges) {
    const key = pointKey(edge.from);
    const candidates = outgoing.get(key) ?? [];
    candidates.push(edge);
    if (!outgoing.has(key)) outgoing.set(key, candidates);
  }
  return outgoing;
}

function traceBoundaryPath(
  start: BoundaryEdge,
  outgoing: ReadonlyMap<string, readonly BoundaryEdge[]>,
  visited: Set<string>,
): ToonMaskPoint[][] {
  if (visited.has(edgeKey(start))) return [];
  const points: ToonMaskPoint[] = [];
  let edge: BoundaryEdge | null = start;
  while (edge && !visited.has(edgeKey(edge))) {
    visited.add(edgeKey(edge));
    points.push(edge.from);
    edge = nextBoundaryEdge({ current: edge, start, outgoing, visited });
  }
  return edge && edgeKey(edge) === edgeKey(start) && points.length >= 3
    ? [points]
    : [];
}

function nextBoundaryEdge(request: {
  readonly current: BoundaryEdge;
  readonly start: BoundaryEdge;
  readonly outgoing: ReadonlyMap<string, readonly BoundaryEdge[]>;
  readonly visited: ReadonlySet<string>;
}): BoundaryEdge | null {
  const candidates = request.outgoing.get(pointKey(request.current.to)) ?? [];
  return [...candidates]
    .filter((candidate) => candidate === request.start ||
      !request.visited.has(edgeKey(candidate)))
    .sort((left, right) => boundaryTurnRank(request.current, left) -
      boundaryTurnRank(request.current, right))[0] ?? null;
}

function boundaryTurnRank(current: BoundaryEdge, candidate: BoundaryEdge): number {
  const turn = (edgeDirection(candidate) - edgeDirection(current) + 4) % 4;
  return [1, 0, 3, 2].indexOf(turn);
}

function edgeDirection(edge: BoundaryEdge): number {
  const dx = edge.to.x - edge.from.x;
  const dy = edge.to.y - edge.from.y;
  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}
