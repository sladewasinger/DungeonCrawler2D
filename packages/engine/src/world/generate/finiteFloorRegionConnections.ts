/* eslint-disable max-lines */
import { hash2D } from "../../core/rng.js";
import { carveAt, isCarved, localIndex } from "./finiteFloorBuffers.js";
import { FLOOR_SEMANTIC, type FloorBounds, type FloorBuffers, type FloorPoint, type GeneratedConnector } from "./finiteFloorTypes.js";
import { TILE } from "../core/types.js";
import { carveRegionBridge, nearestDisconnectedBridge, regionRepresentatives, type RegionBridge } from "./connections/finiteRegionBridges.js";
import { createBridgeSearchWorkspace, type BridgeSearchWorkspace } from "./connections/bridges/finiteRegionBridgeSearch.js";

export interface ConnectorCandidate extends FloorPoint {
  readonly regionIds: readonly number[];
  readonly endpoints: readonly [FloorPoint, FloorPoint];
}

export interface RegionConnectionResult {
  readonly spanning: readonly GeneratedConnector[];
  readonly remaining: readonly ConnectorCandidate[];
  readonly candidateCount: number;
  readonly regionCount: number;
  readonly mergeCount: number;
  readonly bridgeWidths: readonly number[];
}

export function connectDungeonRegions(input: {
  readonly buffers: FloorBuffers;
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly corridorWidth: number;
  readonly corridorWidthMax?: number;
  readonly connectorDensity?: number;
  readonly searchWorkspace?: BridgeSearchWorkspace;
  readonly preconnectedRegionIds?: readonly (readonly [number, number])[];
  readonly preconnectedConnectors?: readonly GeneratedConnector[];
  readonly preferredRegionPoints: ReadonlyMap<number, FloorPoint>;
}): RegionConnectionResult {
  const candidates = connectorCandidates(input);
  const regions = activeRegions(input.buffers);
  const sets = new RegionSets(regions);
  const searchWorkspace = createBridgeSearchWorkspace(input.bounds);
  let mergeCount = 0;
  for (const link of input.preconnectedRegionIds ?? []) mergeCount += sets.unionAll(link);
  const preconnected = admitPreconnectedConnectors(input.preconnectedConnectors);
  mergeCount += preconnected.mergeCount;
  const spanning = preconnected.connectors;
  const state = { sets, spanning, remaining: [], widths: [], mergeCount };
  const bridgeInput = { ...input, searchWorkspace };
  processCandidates(bridgeInput, candidates, state);
  const fallback = connectDistantRegions(bridgeInput, { regions, sets, spanning: state.spanning });
  return { spanning: state.spanning, remaining: state.remaining, candidateCount: candidates.length + fallback.count, regionCount: regions.length, mergeCount: state.mergeCount + fallback.count, bridgeWidths: [...state.widths, ...fallback.widths] };
}

function admitPreconnectedConnectors(connectors: readonly GeneratedConnector[] | undefined): {
  readonly connectors: GeneratedConnector[];
  readonly mergeCount: number;
} {
  // Maze crossings are already carved physical edges. Their region labels can
  // span fragmented authored components, so ordinary bridge admission must
  // establish the DSU from actual bridge geometry before counting merges.
  return { connectors: [...connectors ?? []], mergeCount: 0 };
}

function processCandidates(input: Parameters<typeof connectDungeonRegions>[0], candidates: readonly ConnectorCandidate[], state: { readonly sets: RegionSets; readonly spanning: GeneratedConnector[]; readonly remaining: ConnectorCandidate[]; readonly widths: number[]; mergeCount: number }): void {
  for (const candidate of orderCandidates(candidates, input.seed)) state.mergeCount += processCandidate(input, candidate, state);
}

function processCandidate(input: Parameters<typeof connectDungeonRegions>[0], candidate: ConnectorCandidate, state: { readonly sets: RegionSets; readonly spanning: GeneratedConnector[]; readonly remaining: ConnectorCandidate[]; readonly widths: number[] }): number {
  const merges = state.sets.requiredMerges(candidate.regionIds);
  if (merges === 0) { state.remaining.push(candidate); return 0; }
  const width = bridgeWidth(input, candidate);
  if (!openOrdinaryConnector(input, candidate, width)) { state.remaining.push(candidate); return 0; }
  state.sets.unionAll(candidate.regionIds);
  state.widths.push(width);
  state.spanning.push(connectorMetadata(candidate, { loop: false, pathSaving: 0, protected: true }));
  return merges;
}

function connectDistantRegions(input: Parameters<typeof connectDungeonRegions>[0], state: { readonly regions: readonly number[]; readonly sets: RegionSets; readonly spanning: GeneratedConnector[] }): { readonly count: number; readonly widths: readonly number[] } {
  const representatives = regionRepresentatives(input.buffers, input.bounds, input.preferredRegionPoints);
  const rejected = new Set<string>();
  let count = 0;
  const widths: number[] = [];
  while (state.sets.requiredMerges(state.regions) > 0) {
    const bridge = nearestDisconnectedBridge({
      regions: state.regions,
      representatives,
      connected: (left, right) => state.sets.same(left, right) || rejected.has(regionPair(left, right)),
    });
    if (!bridge) break;
    const width = bridgeWidth(input, bridge);
    if (!carveRegionBridge({ ...input, width, bridge })) {
      rejected.add(regionPair(bridge.regionIds[0], bridge.regionIds[1]));
      continue;
    }
    widths.push(width);
    state.sets.unionAll(bridge.regionIds);
    const endpoint = bridge.endpoints[0];
    state.spanning.push({ x: endpoint.x, y: endpoint.y, regionIds: bridge.regionIds, loop: false, protected: true, pathSaving: 0 });
    count++;
  }
  return { count, widths };
}

function regionPair(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function bridgeWidth(input: Parameters<typeof connectDungeonRegions>[0], bridge: ConnectorCandidate | { readonly endpoints: readonly [FloorPoint, FloorPoint] }): number {
  const [from, to] = bridge.endpoints;
  const maximum = Math.max(input.corridorWidth, input.corridorWidthMax ?? input.corridorWidth);
  const range = maximum - input.corridorWidth + 1;
  return input.corridorWidth + hash2D(input.seed, from.x + to.x, from.y + to.y) % Math.max(1, range);
}

function openOrdinaryConnector(input: Parameters<typeof connectDungeonRegions>[0], candidate: ConnectorCandidate, width: number): boolean {
  const first = candidate.regionIds[0];
  const second = candidate.regionIds[1];
  if (first === undefined || second === undefined) return false;
  const bridge: RegionBridge = { regionIds: [first, second], endpoints: candidate.endpoints, position: candidate };
  return carveRegionBridge({ ...input, width, bridge });
}

function connectorCandidates(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number; readonly connectorDensity?: number }): ConnectorCandidate[] {
  const candidates: ConnectorCandidate[] = [];
  for (let y = input.bounds.minY + 1; y < input.bounds.maxY; y++) {
    for (let x = input.bounds.minX + 1; x < input.bounds.maxX; x++) {
      const candidate = connectorAt(input, { x, y });
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function connectorAt(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds; readonly seed: number; readonly connectorDensity?: number }, point: FloorPoint): ConnectorCandidate | null {
  if (hash2D(input.seed, point.x, point.y) / 0x1_0000_0000 > (input.connectorDensity ?? 1)) return null;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (isCarved(input.buffers, index) || input.buffers.protectedCells[index]) return null;
  const adjacent = [{ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 }]
    .map((neighbor) => ({ point: neighbor, region: carvedRegion(input, neighbor) }))
    .filter(({ region }) => region > 0);
  if (adjacent.some(({ point: endpoint }) => input.buffers.features[localIndex({ bounds: input.bounds, ...endpoint })] !== TILE.Floor)) return null;
  const regionIds = [...new Set(adjacent.map(({ region }) => region))];
  if (regionIds.length < 2) return null;
  const endpoints = connectorEndpoints(adjacent);
  return endpoints ? { ...point, regionIds, endpoints } : null;
}

function connectorEndpoints(adjacent: readonly { readonly point: FloorPoint; readonly region: number }[]): readonly [FloorPoint, FloorPoint] | null {
  for (let first = 0; first < adjacent.length; first++) {
    const a = adjacent[first];
    const b = adjacent.slice(first + 1).find((candidate) => candidate.region !== a?.region);
    if (a && b) return [a.point, b.point];
  }
  return null;
}

function carvedRegion(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, point: FloorPoint): number {
  const index = localIndex({ bounds: input.bounds, ...point });
  return isCarved(input.buffers, index) ? input.buffers.region[index] ?? 0 : 0;
}

function activeRegions(buffers: FloorBuffers): number[] {
  return [...new Set(Array.from(buffers.region).filter((region) => region > 0))].sort((a, b) => a - b);
}

function orderCandidates(candidates: readonly ConnectorCandidate[], seed: number): ConnectorCandidate[] {
  return [...candidates].sort((a, b) => {
    const roll = hash2D(seed, a.x, a.y) - hash2D(seed, b.x, b.y);
    return roll || a.y - b.y || a.x - b.x;
  });
}

export function openConnector(input: { readonly buffers: FloorBuffers; readonly bounds: FloorBounds }, candidate: ConnectorCandidate, protect: boolean): void {
  const region = candidate.regionIds[0];
  if (region === undefined) return;
  carveAt({ buffers: input.buffers, bounds: input.bounds, point: candidate, semantic: FLOOR_SEMANTIC.Transition, regionId: region });
  if (!protect) return;
  input.buffers.protectedCells[localIndex({ bounds: input.bounds, ...candidate })] = 1;
  for (const endpoint of candidate.endpoints) input.buffers.protectedCells[localIndex({ bounds: input.bounds, ...endpoint })] = 1;
}

export function connectorMetadata(candidate: ConnectorCandidate, policy: {
  readonly loop: boolean;
  readonly pathSaving: number;
  readonly protected: boolean;
}): GeneratedConnector {
  return { x: candidate.x, y: candidate.y, regionIds: candidate.regionIds, ...policy };
}

class RegionSets {
  private readonly parents = new Map<number, number>();

  constructor(regions: readonly number[]) {
    for (const region of regions) this.parents.set(region, region);
  }

  requiredMerges(regions: readonly number[]): number {
    return Math.max(0, new Set(regions.map((region) => this.find(region))).size - 1);
  }

  unionAll(regions: readonly number[]): number {
    let merges = 0;
    const first = regions[0];
    if (first === undefined) return merges;
    for (const region of regions.slice(1)) merges += this.union(first, region);
    return merges;
  }

  same(left: number, right: number): boolean { return this.find(left) === this.find(right); }

  private union(a: number, b: number): number {
    const rootA = this.find(a); const rootB = this.find(b);
    if (rootA === rootB) return 0;
    this.parents.set(rootB, rootA);
    return 1;
  }

  private find(region: number): number {
    const parent = this.parents.get(region);
    if (parent === undefined || parent === region) return region;
    const root = this.find(parent);
    this.parents.set(region, root);
    return root;
  }
}
