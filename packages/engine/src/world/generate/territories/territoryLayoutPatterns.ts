/* eslint-disable max-lines */
import { hash2D } from "../../../core/rng.js";
import { carveAt, insideBounds, isCarved, localIndex, stampSolid } from "../finiteFloorBuffers.js";
import { territoryProfile } from "./territoryCatalog.js";
import { carveRegionBridge } from "../connections/finiteRegionBridges.js";
import {
  FLOOR_SEMANTIC,
  type FloorBounds,
  type FloorBuffers,
  type FloorPoint,
  type GeneratedRoom,
  type GeneratedTerritoryLayout,
  type NormalizedFloorGenerationConfig,
} from "../finiteFloorTypes.js";
interface TerritoryLayoutInput {
  readonly buffers: FloorBuffers; readonly bounds: FloorBounds;
  readonly config: NormalizedFloorGenerationConfig; readonly rooms: readonly GeneratedRoom[];
  readonly seed: number; readonly firstRegionId: number;
  readonly backbonePoint: FloorPoint; readonly backboneRegionId: number;
}
interface LayoutCounts {
  openedCells: number; obstacleCells: number;
  branchPockets: number; elevatedCells: number;
  metrics: Record<string, number>;
}
export function applyTerritoryLayouts(input: TerritoryLayoutInput): GeneratedTerritoryLayout[] {
  return input.config.territoryRoster.map((territoryId, territory) => {
    const profile = territoryProfile(territoryId);
    const metadata = territoryMetadata(profile);
    if (hash2D(input.seed, territory, 17) / 0x1_0000_0000 > input.config.territoryLayoutDensity) {
      return { ...metadata, ...emptyCounts(), materialized: false, geometryMetrics: {} };
    }
    const counts = emptyCounts();
    const territoryInput = {
      ...input, territory, counts,
      territoryRegionId: input.firstRegionId + territory,
    };
    stampTerritory(territoryInput, profile.layoutSignature);
    connectTerritoryToBackbone(territoryInput);
    return { ...metadata, ...counts, materialized: true, geometryMetrics: counts.metrics };
  });
}

function territoryMetadata(profile: ReturnType<typeof territoryProfile>): Pick<GeneratedTerritoryLayout, "territoryId" | "catalogId" | "label" | "visualIdentity" | "ownershipTags" | "layoutSignature"> {
  return {
    territoryId: profile.id,
    catalogId: profile.id,
    label: profile.name,
    visualIdentity: profile.visualIdentity,
    ownershipTags: [...profile.ownershipTags],
    layoutSignature: profile.layoutSignature,
  };
}
type StampInput = TerritoryLayoutInput & {
  readonly territory: number; readonly counts: LayoutCounts; readonly territoryRegionId: number;
};
function stampTerritory(input: StampInput, signature: string): void {
  const defaultStamp = DEFAULT_STAMPERS[signature];
  if (defaultStamp) { defaultStamp(input); return; }
  stampCatalogTerritory(input, signature);
}
function stampPowderworks(input: StampInput): void {
  const anchors = territoryAnchors(input).slice(0, 5);
  for (const anchor of anchors) {
    carveBox(input, { center: anchor, halfWidth: 10, halfHeight: 6 });
    carveBox(input, { center: add(anchor, { x: 0, y: 9 }), halfWidth: 6, halfHeight: 2 });
    const obstacles = POWDERWORKS_OBSTACLES.filter((offset) => stampObstacle(input, add(anchor, offset))).length;
    if (obstacles === 0) stampNearbyObstacle(input, anchor);
    markMetric(input, "workshops", 2);
    markMetric(input, "blastBays", 2);
  }
  linkAnchors(input, { anchors, width: 2, metric: "fuseLinks" });
}
function stampBroodcourt(input: StampInput): void {
  const anchors = territoryAnchors(input).slice(0, 4);
  for (const anchor of anchors) {
    carveBox(input, { center: anchor, halfWidth: 8, halfHeight: 8 });
    markMetric(input, "nestCores");
    for (const direction of CARDINAL) stampBroodPocket(input, anchor, direction);
    for (const offset of BROODCOURT_PILLARS) {
      stampObstacle(input, add(anchor, offset));
      markMetric(input, "cocoonPillars");
    }
  }
  linkAnchors(input, { anchors, width: 1, metric: "nestLoops" });
}
function stampBroodPocket(input: StampInput, anchor: FloorPoint, direction: FloorPoint): void {
  const pocket = { x: anchor.x + direction.x * 14, y: anchor.y + direction.y * 14 };
  const opened = carveBox(input, { center: pocket, halfWidth: 4, halfHeight: 4 });
  if (opened > 0) input.counts.branchPockets++;
  if (touchesLine(input, { from: anchor, to: pocket, width: 1 })) markMetric(input, "ambushThroats");
}
function stampGaol(input: StampInput): void {
  const anchors = territoryAnchors(input).slice(0, 8);
  for (const anchor of anchors) {
    carveBox(input, { center: anchor, halfWidth: 5, halfHeight: 3 });
    for (let x = anchor.x - 3; x <= anchor.x + 3; x += 2) {
      for (const offsetY of GAOL_CELL_ROWS) stampObstacle(input, { x, y: anchor.y + offsetY });
    }
    markMetric(input, "cellBlocks");
  }
  linkAnchors(input, { anchors, width: 1, metric: "guardLoops" });
  markMetric(input, "flankCorridors", Math.max(0, anchors.length - 1));
}
function stampStarChapel(input: StampInput): void {
  const anchor = focusAnchor(input);
  if (!anchor) return;
  carveRing(input, anchor, 8);
  carveRing(input, anchor, 16);
  markMetric(input, "ritualRings", 2);
  for (const direction of CARDINAL) { carveArm(input, { center: anchor, direction, length: 30 }); markMetric(input, "ritualArms"); }
  for (let y = anchor.y - 1; y <= anchor.y + 1; y++) {
    for (let x = anchor.x - 1; x <= anchor.x + 1; x++) elevateCell(input, { x, y });
  }
}
function focusAnchor(input: StampInput): FloorPoint | null {
  const anchors = territoryAnchors(input);
  return anchors.find((point) => eligibleCell(input, point)) ?? firstOpenTerritoryCell(input) ?? anchors[0] ?? null;
}
function firstOpenTerritoryCell(input: StampInput): FloorPoint | null {
  for (let y = input.bounds.minY + 1; y < input.bounds.maxY; y++) for (let x = input.bounds.minX + 1; x < input.bounds.maxX; x++) {
    const point = { x, y }; const index = localIndex({ bounds: input.bounds, ...point });
    if (territoryCellOpen(input, index)) return point;
  }
  return null;
}
function territoryCellOpen(input: StampInput, index: number): boolean {
  return input.buffers.territory[index] === input.territory && isCarved(input.buffers, index)
    && (input.buffers.roomWallIds[index] ?? -1) < 0 && !(input.buffers.protectedCells[index] ?? 0);
}
function stampCatalogTerritory(input: StampInput, signature: string): void {
  const anchors = territoryAnchors(input).slice(0, 6);
  const pattern = signaturePattern(signature);
  if (pattern === "spine") linkAnchors(input, { anchors, width: 2, metric: "spineLinks" });
  if (pattern === "chambers") stampChambers(input, anchors);
  if (pattern === "rings") stampRings(input, anchors);
  if (pattern === "lattice") stampLattice(input, anchors);
  if (pattern === "courts") stampCourts(input, anchors);
  if (pattern === "galleries") stampGalleries(input, anchors);
  if (pattern === "switchback") stampSwitchback(input, anchors);
  markMetric(input, "structuralCells", countTerritoryCarved(input));
}

function stampChambers(input: StampInput, anchors: readonly FloorPoint[]): void {
  for (const anchor of anchors) { carveBox(input, { center: anchor, halfWidth: 3, halfHeight: 3 }); markMetric(input, "chambers"); }
  linkAnchors(input, { anchors, width: 1, metric: "chamberLinks" });
}
function stampRings(input: StampInput, anchors: readonly FloorPoint[]): void {
  for (const anchor of anchors.slice(0, 3)) { carveRing(input, anchor, 3); carveRing(input, anchor, 6); markMetric(input, "rings", 2); }
}
function stampLattice(input: StampInput, anchors: readonly FloorPoint[]): void {
  linkAnchors(input, { anchors, width: 1, metric: "latticeLinks" });
  for (const anchor of anchors) { stampObstacle(input, add(anchor, { x: 2, y: 0 })); markMetric(input, "nodes"); }
}
function stampCourts(input: StampInput, anchors: readonly FloorPoint[]): void {
  for (const anchor of anchors) { carveBox(input, { center: anchor, halfWidth: 4, halfHeight: 2 }); markMetric(input, "courts"); }
  linkAnchors(input, { anchors, width: 2, metric: "courtLinks" });
}
function stampGalleries(input: StampInput, anchors: readonly FloorPoint[]): void {
  for (const anchor of anchors) { carveBox(input, { center: anchor, halfWidth: 2, halfHeight: 5 }); markMetric(input, "galleries"); }
  linkAnchors(input, { anchors, width: 1, metric: "galleryLinks" });
}
function stampSwitchback(input: StampInput, anchors: readonly FloorPoint[]): void {
  for (let index = 1; index < anchors.length; index++) {
    const previous = anchors[index - 1]; const current = anchors[index];
    if (!previous || !current) continue;
    const bend = { x: current.x, y: previous.y + (index % 2 === 0 ? 3 : -3) };
    touchesLine(input, { from: previous, to: bend, width: 1 }); touchesLine(input, { from: bend, to: current, width: 1 }); markMetric(input, "switchbacks");
  }
}
function signaturePattern(signature: string): string {
  return SIGNATURE_PATTERNS.find(({ matches }) => matches.some((term) => signature.includes(term)))?.pattern ?? "spine";
}
function territoryAnchors(input: StampInput): FloorPoint[] {
  const roomCenters = territoryRooms(input).map(({ center }) => center);
  if (roomCenters.length > 0) return roomCenters.toSorted((a, b) => anchorOrder(input.seed, a, b));
  return seededTerritoryAnchors(input);
}
function seededTerritoryAnchors(input: StampInput): FloorPoint[] {
  const anchors: FloorPoint[] = [];
  const attempts = Math.min(1024, input.bounds.width * input.bounds.height);
  for (let attempt = 0; attempt < attempts && anchors.length < 6; attempt++) {
    const point = seededTerritoryPoint(input, attempt);
    if (!territoryAnchorAvailable(input, point)) continue;
    if (anchors.some((anchor) => Math.abs(anchor.x - point.x) + Math.abs(anchor.y - point.y) < 12)) continue;
    anchors.push(point);
  }
  return anchors;
}
function seededTerritoryPoint(input: StampInput, attempt: number): FloorPoint {
  const spanX = Math.max(1, input.bounds.width - 2);
  const spanY = Math.max(1, input.bounds.height - 2);
  return {
    x: input.bounds.minX + 1 + hash2D(input.seed, input.territory, attempt) % spanX,
    y: input.bounds.minY + 1 + hash2D(input.seed, attempt, input.territory + 31) % spanY,
  };
}
function territoryAnchorAvailable(input: StampInput, point: FloorPoint): boolean {
  if (!insidePlayableBounds(input.bounds, point)) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  return input.buffers.territory[index] === input.territory && cellAvailable(input.buffers, index);
}

function connectTerritoryToBackbone(input: StampInput): void {
  for (const component of territoryComponents(input)) {
    const target = pointAtIndex(input.bounds, component[0] ?? 0);
    const connected = connectTerritoryComponent(input, target);
    if (!connected) return;
    for (const index of component) input.buffers.region[index] = input.backboneRegionId;
    markMetric(input, "backboneLinks");
  }
}

function connectTerritoryComponent(input: StampInput, target: FloorPoint): boolean {
  const bridge = carveRegionBridge({
    buffers: input.buffers, bounds: input.bounds, seed: input.seed + input.territory,
    width: Math.min(2, input.config.roomEntranceWidth),
    bridge: {
      regionIds: [input.backboneRegionId, input.territoryRegionId],
      endpoints: [input.backbonePoint, target], position: target,
    },
  });
  return bridge || carveDeterministicApproach(input, target);
}

function territoryComponents(input: StampInput): number[][] {
  const components: number[][] = [];
  const visited = new Uint8Array(input.buffers.tiles.length);
  for (let index = 0; index < input.buffers.tiles.length; index++) {
    if (territoryCellVisited(input, visited, index)) continue;
    components.push(collectTerritoryComponent(input, visited, index));
  }
  return components;
}

function territoryCellVisited(input: StampInput, visited: Uint8Array, index: number): boolean {
  return visited[index] === 1 || input.buffers.region[index] !== input.territoryRegionId || !isCarved(input.buffers, index);
}

function collectTerritoryComponent(input: StampInput, visited: Uint8Array, start: number): number[] {
  const component = [start];
  const state = { visited, component };
  visited[start] = 1;
  for (let cursor = 0; cursor < component.length; cursor++) {
    const point = pointAtIndex(input.bounds, component[cursor] ?? start);
    appendTerritoryNeighbors(input, state, point);
  }
  return component;
}

function appendTerritoryNeighbors(input: StampInput, state: { readonly visited: Uint8Array; readonly component: number[] }, point: FloorPoint): void {
  for (const direction of CARDINAL) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    const nextIndex = territoryNeighborIndex(input, next);
    if (nextIndex === null || state.visited[nextIndex] === 1
      || input.buffers.region[nextIndex] !== input.territoryRegionId
      || !isCarved(input.buffers, nextIndex)) continue;
    state.visited[nextIndex] = 1;
    state.component.push(nextIndex);
  }
}

function territoryNeighborIndex(input: StampInput, point: FloorPoint): number | null {
  return insideBounds({ bounds: input.bounds, ...point }) ? localIndex({ bounds: input.bounds, ...point }) : null;
}

function carveDeterministicApproach(input: StampInput, target: FloorPoint): boolean {
  const path = findApproachPath(input, target);
  if (!path) return false;
  for (const point of path) {
    const index = localIndex({ bounds: input.bounds, ...point });
    if (!isCarved(input.buffers, index)) carveAt({ buffers: input.buffers, bounds: input.bounds, point, semantic: FLOOR_SEMANTIC.Transition, regionId: input.backboneRegionId });
    input.buffers.protectedCells[index] = 1;
  }
  return true;
}

function findApproachPath(input: StampInput, target: FloorPoint): FloorPoint[] | null {
  const start = localIndex({ bounds: input.bounds, ...input.backbonePoint });
  const goal = localIndex({ bounds: input.bounds, ...target });
  const state = createApproachSearchState(input, start);
  while (state.head < state.tail) {
    const current = state.queue[state.head++];
    if (current === goal) return restoreApproachPath({ input, previous: state.previous, start, goal });
    appendApproachNeighbors(input, state, pointAtIndex(input.bounds, current ?? start));
  }
  return null;
}

interface ApproachSearchState {
  readonly previous: Int32Array;
  readonly queue: Int32Array;
  head: number;
  tail: number;
}

function createApproachSearchState(input: StampInput, start: number): ApproachSearchState {
  const previous = new Int32Array(input.buffers.tiles.length).fill(-1);
  const queue = new Int32Array(input.buffers.tiles.length);
  previous[start] = start;
  queue[0] = start;
  return { previous, queue, head: 0, tail: 1 };
}

function appendApproachNeighbors(input: StampInput, state: ApproachSearchState, point: FloorPoint): void {
  for (const direction of CARDINAL) {
    const next = { x: point.x + direction.x, y: point.y + direction.y };
    const index = territoryNeighborIndex(input, next);
    if (index === null || (state.previous[index] ?? -1) >= 0 || !approachCellAllowed(input, index)) continue;
    state.previous[index] = localIndex({ bounds: input.bounds, ...point });
    state.queue[state.tail++] = index;
  }
}

function approachCellAllowed(input: StampInput, index: number): boolean {
  return (input.buffers.roomWallIds[index] ?? -1) < 0
    && (!(input.buffers.protectedCells[index] ?? 0) || isCarved(input.buffers, index));
}

function restoreApproachPath(input: { readonly input: StampInput; readonly previous: Int32Array; readonly start: number; readonly goal: number }): FloorPoint[] {
  const path: FloorPoint[] = [];
  for (let cursor = input.goal; cursor !== input.start; cursor = input.previous[cursor] ?? -1) path.push(pointAtIndex(input.input.bounds, cursor));
  path.push(input.input.backbonePoint);
  return path.reverse();
}

function pointAtIndex(bounds: FloorBounds, index: number): FloorPoint {
  return { x: bounds.minX + index % bounds.width, y: bounds.minY + Math.floor(index / bounds.width) };
}

function territoryRooms(input: StampInput): GeneratedRoom[] {
  return input.rooms.filter(({ center }) => input.buffers.territory[localIndex({ bounds: input.bounds, ...center })] === input.territory);
}
function carveBox(input: StampInput, geometry: { readonly center: FloorPoint; readonly halfWidth: number; readonly halfHeight: number }): number {
  let opened = 0;
  for (let y = geometry.center.y - geometry.halfHeight; y <= geometry.center.y + geometry.halfHeight; y++) {
    for (let x = geometry.center.x - geometry.halfWidth; x <= geometry.center.x + geometry.halfWidth; x++) opened += carveTerritoryCell(input, { x, y });
  }
  return opened;
}
function carveRing(input: StampInput, center: FloorPoint, radius: number): number {
  let touched = 0;
  for (let offset = -radius; offset <= radius; offset++) {
    touched += carveTerritoryCell(input, { x: center.x + offset, y: center.y - radius });
    touched += carveTerritoryCell(input, { x: center.x + offset, y: center.y + radius });
    touched += carveTerritoryCell(input, { x: center.x - radius, y: center.y + offset });
    touched += carveTerritoryCell(input, { x: center.x + radius, y: center.y + offset });
  }
  return touched;
}
function linkAnchors(input: StampInput, geometry: { readonly anchors: readonly FloorPoint[]; readonly width: number; readonly metric: string }): void {
  for (let index = 1; index < geometry.anchors.length; index++) {
    const from = geometry.anchors[index - 1] as FloorPoint; const to = geometry.anchors[index] as FloorPoint;
    if (touchesLine(input, { from, to, width: geometry.width })) markMetric(input, geometry.metric);
  }
}
function touchesLine(input: StampInput, geometry: { readonly from: FloorPoint; readonly to: FloorPoint; readonly width: number }): boolean {
  let touched = false;
  const bend = { x: geometry.to.x, y: geometry.from.y };
  for (const point of [...line(geometry.from, bend, geometry.width), ...line(bend, geometry.to, geometry.width)]) {
    const index = localIndex({ bounds: input.bounds, ...point });
    if (insideBounds({ bounds: input.bounds, ...point }) && input.buffers.territory[index] === input.territory) {
      touched = true; carveTerritoryCell(input, point);
    }
  }
  return touched;
}
function line(from: FloorPoint, to: FloorPoint, width: number): FloorPoint[] {
  const direction = { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  const side = { x: -direction.y, y: direction.x }; const points: FloorPoint[] = [];
  const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  for (let distance = 0; distance <= length; distance++) for (let offset = 0; offset < width; offset++) {
    points.push({ x: from.x + direction.x * distance + side.x * offset, y: from.y + direction.y * distance + side.y * offset });
  }
  return points;
}
function carveArm(input: StampInput, geometry: { readonly center: FloorPoint; readonly direction: FloorPoint; readonly length: number }): void {
  for (let distance = 1; distance <= geometry.length; distance++) {
    const point = { x: geometry.center.x + geometry.direction.x * distance, y: geometry.center.y + geometry.direction.y * distance };
    const side = { x: -geometry.direction.y, y: geometry.direction.x };
    for (let offset = -2; offset <= 2; offset++) carveTerritoryCell(input, { x: point.x + side.x * offset, y: point.y + side.y * offset });
  }
}
function carveTerritoryCell(input: StampInput, point: FloorPoint): number {
  if (!eligibleCell(input, point)) return 0;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (isCarved(input.buffers, index)) return 0;
  carveAt({
    buffers: input.buffers, bounds: input.bounds, point,
    semantic: FLOOR_SEMANTIC.Corridor, regionId: input.territoryRegionId,
  });
  input.counts.openedCells++;
  return 1;
}
function stampObstacle(input: StampInput, point: FloorPoint): boolean {
  if (!eligibleCell(input, point)) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (!isCarved(input.buffers, index)) return false;
  stampSolid({ buffers: input.buffers, bounds: input.bounds, ...point });
  input.buffers.region[index] = 0;
  input.counts.obstacleCells++;
  return true;
}
function stampNearbyObstacle(input: StampInput, center: FloorPoint): void {
  for (let radius = 1; radius <= 6; radius++) {
    const candidates = CARDINAL.map((direction) => add(center, { x: direction.x * radius, y: direction.y * radius }));
    if (candidates.some((point) => stampObstacle(input, point))) return;
  }
}
function elevateCell(input: StampInput, point: FloorPoint): void {
  if (!eligibleCell(input, point)) return;
  const index = localIndex({ bounds: input.bounds, ...point });
  if (!isCarved(input.buffers, index)) return;
  input.buffers.height[index] = 0.25;
  input.counts.elevatedCells++;
}
function eligibleCell(input: StampInput, point: FloorPoint): boolean {
  if (!insidePlayableBounds(input.bounds, point)) return false;
  const index = localIndex({ bounds: input.bounds, ...point });
  return input.buffers.territory[index] === input.territory && cellAvailable(input.buffers, index);
}
function insidePlayableBounds(bounds: FloorBounds, point: FloorPoint): boolean {
  return insideBounds({ bounds, ...point }) && point.x > bounds.minX && point.x < bounds.maxX
    && point.y > bounds.minY && point.y < bounds.maxY;
}
function cellAvailable(buffers: FloorBuffers, index: number): boolean {
  return (buffers.roomWallIds[index] ?? -1) < 0 && !(buffers.protectedCells[index] ?? 0) && (buffers.features[index] ?? 0) === 0;
}
function anchorOrder(seed: number, a: FloorPoint, b: FloorPoint): number { return hash2D(seed, a.x, a.y) - hash2D(seed, b.x, b.y) || a.y - b.y || a.x - b.x; }
function countTerritoryCarved(input: StampInput): number {
  let count = 0;
  for (let y = input.bounds.minY + 1; y < input.bounds.maxY; y++) for (let x = input.bounds.minX + 1; x < input.bounds.maxX; x++) {
    const index = localIndex({ bounds: input.bounds, x, y });
    if (input.buffers.territory[index] === input.territory && isCarved(input.buffers, index)) count++;
  }
  return count;
}
function markMetric(input: StampInput, key: string, amount = 1): void { input.counts.metrics[key] = (input.counts.metrics[key] ?? 0) + amount; }
function add(left: FloorPoint, right: FloorPoint): FloorPoint { return { x: left.x + right.x, y: left.y + right.y }; }
function emptyCounts(): LayoutCounts { return { openedCells: 0, obstacleCells: 0, branchPockets: 0, elevatedCells: 0, metrics: {} }; }
const DEFAULT_STAMPERS: Readonly<Record<string, (input: StampInput) => void>> = {
  "workshop-clusters": stampPowderworks,
  "radial-brood-chambers": stampBroodcourt,
  "cell-block-guard-loops": stampGaol,
  "ritual-rings": stampStarChapel,
};
const SIGNATURE_PATTERNS = [
  { pattern: "switchback", matches: ["countermine", "slalom"] },
  { pattern: "rings", matches: ["ring", "vault", "mechanical"] },
  { pattern: "galleries", matches: ["gallery", "nave"] },
  { pattern: "courts", matches: ["court", "formation"] },
  { pattern: "lattice", matches: ["resonator"] },
  { pattern: "chambers", matches: ["chamber", "containment", "mirror"] },
] as const;
const POWDERWORKS_OBSTACLES = [
  { x: -7, y: -3 }, { x: -3, y: -3 }, { x: 3, y: -3 }, { x: 7, y: -3 },
  { x: -7, y: 3 }, { x: -3, y: 3 }, { x: 3, y: 3 }, { x: 7, y: 3 },
] as const;
const BROODCOURT_PILLARS = [
  { x: -5, y: -5 }, { x: 5, y: -5 }, { x: -5, y: 5 }, { x: 5, y: 5 },
] as const;
const GAOL_CELL_ROWS = [-4, -2, 2, 4] as const;
const CARDINAL = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] as const;
