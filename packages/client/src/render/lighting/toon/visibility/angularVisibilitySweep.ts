import { AngularShadowField } from "./angularShadowField.js";

export interface VisibilitySweepBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisibilitySweepCell {
  readonly x: number;
  readonly y: number;
}

interface OrderedCell extends VisibilitySweepCell {
  readonly distanceSquared: number;
}

interface VisibilitySweepState {
  readonly shadows: AngularShadowField;
  evaluatedCells: number;
  occluderChecks: number;
}

export interface AngularVisibilitySweep {
  readonly evaluatedCells: number;
  readonly occluderChecks: number;
}

/**
 * Visits cells with an unobstructed center ray. Each cell is evaluated
 * once; opaque cells contribute a merged angular shadow instead of launching
 * a new grid ray toward every destination.
 */
export function sweepAngularVisibility(input: {
  readonly bounds: VisibilitySweepBounds;
  readonly origin: VisibilitySweepCell;
  readonly isOpaque: (cell: VisibilitySweepCell) => boolean;
  readonly visit: (cell: VisibilitySweepCell) => void;
}): AngularVisibilitySweep {
  const state: VisibilitySweepState = {
    shadows: new AngularShadowField(),
    evaluatedCells: 0,
    occluderChecks: 0,
  };
  for (const cell of orderedVisibilityCells(input.bounds, input.origin)) {
    visitSweepCell(input, state, cell);
    if (state.shadows.coversAll()) break;
  }
  return {
    evaluatedCells: state.evaluatedCells,
    occluderChecks: state.occluderChecks,
  };
}

function visitSweepCell(
  input: {
    readonly origin: VisibilitySweepCell;
    readonly isOpaque: (cell: VisibilitySweepCell) => boolean;
    readonly visit: (cell: VisibilitySweepCell) => void;
  },
  state: VisibilitySweepState,
  cell: OrderedCell,
): void {
  state.evaluatedCells += 1;
  const origin = sameCell(cell, input.origin);
  if (!origin && state.shadows.obscures(input.origin, cell)) return;
  input.visit(cell);
  state.occluderChecks += 1;
  if (origin || !input.isOpaque(cell)) return;
  state.shadows.add(input.origin, cell);
}

function orderedVisibilityCells(
  bounds: VisibilitySweepBounds,
  origin: VisibilitySweepCell,
): OrderedCell[] {
  const cells: OrderedCell[] = [];
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
      cells.push({ x, y, distanceSquared: cellDistanceSquared(origin, { x, y }) });
    }
  }
  return cells.sort((left, right) =>
    left.distanceSquared - right.distanceSquared ||
    left.y - right.y ||
    left.x - right.x);
}

function cellDistanceSquared(
  origin: VisibilitySweepCell,
  cell: VisibilitySweepCell,
): number {
  const dx = cell.x - origin.x;
  const dy = cell.y - origin.y;
  return dx * dx + dy * dy;
}

function sameCell(
  left: VisibilitySweepCell,
  right: VisibilitySweepCell,
): boolean {
  return left.x === right.x && left.y === right.y;
}
