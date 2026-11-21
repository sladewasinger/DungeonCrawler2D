import { carvedDistanceAtLeast, createCarvedDistanceWorkspace } from "./finiteFloorPath.js";
import { createFiniteFloorWorkBudget, type FiniteFloorWorkBudget } from "./budget/finiteFloorWorkBudget.js";
import { connectorMetadata, openConnector, type ConnectorCandidate } from "./finiteFloorRegionConnections.js";
import type { FloorBounds, FloorBuffers, FloorPoint, GeneratedConnector } from "./finiteFloorTypes.js";

export function addMeaningfulLoops(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly candidates: readonly ConnectorCandidate[];
  readonly target: number;
  readonly minimumPathSaving: number;
  readonly spacing: number;
}): { readonly loops: GeneratedConnector[]; readonly work: ReturnType<FiniteFloorWorkBudget["summary"]> } {
  const loops: GeneratedConnector[] = [];
  const budget = createFiniteFloorWorkBudget(input.bounds, input.target);
  const workspace = createCarvedDistanceWorkspace(input.buffers.tiles.length);
  for (const candidate of input.candidates) {
    const loop = evaluateLoopCandidate({ input, candidate, loops, budget, workspace });
    if (budget.exhausted) break;
    if (loop) loops.push(loop);
  }
  return { loops, work: budget.summary() };
}

function evaluateLoopCandidate(input: {
  readonly input: Parameters<typeof addMeaningfulLoops>[0];
  readonly candidate: Parameters<typeof addMeaningfulLoops>[0]["candidates"][number];
  readonly loops: readonly GeneratedConnector[];
  readonly budget: FiniteFloorWorkBudget;
  readonly workspace: ReturnType<typeof createCarvedDistanceWorkspace>;
}): GeneratedConnector | null {
  if (input.loops.length >= input.input.target || tooClose(input.loops, input.candidate, input.input.spacing)) return null;
  if (!input.budget.consumeCandidate()) return null;
  const pathSaving = input.input.minimumPathSaving;
  const meaningful = carvedDistanceAtLeast({
    buffers: input.input.buffers, bounds: input.input.bounds,
    from: input.candidate.endpoints[0], to: input.candidate.endpoints[1],
    minimum: pathSaving + 2, workspace: input.workspace, budget: input.budget,
  });
  if (!meaningful || input.budget.exhausted) return null;
  openConnector(input.input, input.candidate, true);
  return connectorMetadata(input.candidate, { loop: true, pathSaving, protected: true });
}

function tooClose(connectors: readonly GeneratedConnector[], point: FloorPoint, spacing: number): boolean {
  return connectors.some((connector) => Math.abs(connector.x - point.x) <= spacing
    && Math.abs(connector.y - point.y) <= spacing);
}
