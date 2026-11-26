/** Dynamic non-square POI shapes, prop layouts, lighting, and guard rosters. */
import {
  GroundKind, PropKind,
  type ChunkPoi, type ChunkProp, type PoiKind, type PoiLayoutKind, type PointLightSpec,
} from "./types.js";
import {
  frontierPoiFloorGround, getFrontierPoiSpec, isInsideFrontierPoiMask, stampFrontierPoiProps,
} from "./pois/frontierPoiLayouts.js";

export type PoiGuardKind = "goblin" | "orc" | "skeleton" | "golem" | "spider" | "slime";

export interface PoiLayoutSpec {
  readonly kind: PoiKind;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly chestOffset: readonly [number, number];
  readonly guards: readonly PoiGuardKind[];
  readonly mask: "oct" | "l-shape" | "courtyard" | "cross" | "sanctum";
  readonly fences: readonly (readonly [number, number])[];
  readonly tents: readonly (readonly [number, number])[];
  readonly campfires: readonly (readonly [number, number])[];
  readonly pillars: readonly (readonly [number, number])[];
  readonly torches: readonly (readonly [number, number])[];
}

const CAMPFIRE_COLOR = 0xff9a3c;
const TORCH_COLOR = 0xffb357;
const POI_BANDIT: PoiKind = "bandit-camp";
const POI_RUINS: PoiKind = "ancient-ruins";

export const POI_LAYOUTS: Readonly<Record<string, PoiLayoutSpec>> = {
  "camp-outpost": {
    kind: POI_BANDIT, radiusX: 3, radiusY: 3, chestOffset: [0, -1.75],
    guards: ["goblin", "goblin"], mask: "oct",
    fences: [
      [-1, -3], [0, -3], [1, -3], [-2, -2], [2, -2],
      [-3, -1], [3, -1], [-3, 0], [3, 0], [-3, 1], [3, 1], [-2, 2], [2, 2],
    ],
    tents: [[-1.6, -1.75], [1.6, -1.75]],
    campfires: [[0, 0.8]],
    pillars: [],
    torches: [[-1.2, 2.3]],
  },
  "camp-l-shape": {
    kind: POI_BANDIT, radiusX: 4, radiusY: 4, chestOffset: [0, -2.95],
    guards: ["goblin", "goblin", "goblin", "orc"], mask: "l-shape",
    fences: [
      [-3, -4], [-2, -4], [-1, -4], [0, -4], [1, -4],
      [-4, -3], [-4, -2], [-4, -1], [-4, 0], [-4, 1], [-4, 2], [-4, 3],
      [2, -3], [2, -2], [2, -1], [3, -1], [4, 0], [4, 1], [4, 2], [4, 3],
      [-3, 4], [-2, 4], [2, 4], [3, 4],
    ],
    tents: [[-2.4, -2.8], [-2.7, 1.5], [2.7, 1.5]],
    campfires: [[0, 0.4]],
    pillars: [],
    torches: [[0.9, -2.5], [0, 3.3]],
  },
  "camp-courtyard": {
    kind: POI_BANDIT, radiusX: 5, radiusY: 3, chestOffset: [0, -1.8],
    guards: ["goblin", "goblin", "goblin", "goblin", "orc"], mask: "courtyard",
    fences: [
      [-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3],
      [-4, -2], [4, -2], [-5, -1], [5, -1], [-5, 0], [5, 0], [-5, 1], [5, 1], [-4, 2], [4, 2],
      [-3, 3], [-2, 3], [2, 3], [3, 3],
    ],
    tents: [[-2.25, -1.85], [2.25, -1.85], [-3.75, 0.4]],
    campfires: [[0, 0.8]],
    pillars: [],
    torches: [[-1.3, 2.5], [1.3, 2.5]],
  },
  "camp-warband": {
    kind: POI_BANDIT, radiusX: 6, radiusY: 5, chestOffset: [0, -1],
    guards: ["goblin", "goblin", "goblin", "goblin", "goblin", "goblin", "orc", "orc"], mask: "courtyard",
    fences: [
      [-4, -5], [-3, -5], [-2, -5], [-1, -5], [0, -5], [1, -5], [2, -5], [3, -5], [4, -5],
      [-5, -4], [5, -4], [-6, -3], [6, -3], [-6, -2], [6, -2], [-6, -1], [6, -1],
      [-6, 1], [6, 1], [-6, 2], [6, 2], [-6, 3], [6, 3], [-5, 4], [5, 4],
      [-4, 5], [-3, 5], [-2, 5], [2, 5], [3, 5], [4, 5],
    ],
    tents: [[-3.4, -3.75], [0, -3.75], [3.4, -3.75], [-4.65, 2.3], [0, 2.4], [4.65, 2.3]],
    campfires: [[-2.0, -0.3], [2.0, -0.3]],
    pillars: [],
    torches: [[-1.5, 4.3], [1.5, 4.3], [-4.8, -0.6], [4.8, -0.6]],
  },
  "ruins-shrine": {
    kind: POI_RUINS, radiusX: 3, radiusY: 3, chestOffset: [0, 0],
    guards: ["skeleton", "skeleton", "golem"], mask: "cross",
    fences: [], tents: [], campfires: [],
    pillars: [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]],
    torches: [[-1.4, -1.4], [1.4, 1.4]],
  },
  "ruins-colonnade": {
    kind: POI_RUINS, radiusX: 5, radiusY: 3, chestOffset: [2.5, 0],
    guards: ["skeleton", "skeleton", "skeleton", "golem"], mask: "courtyard",
    fences: [], tents: [], campfires: [],
    pillars: [
      [-3.5, -2.2], [-1.2, -2.2], [1.1, -2.2], [3.5, -2.2],
      [-3.5, 2.2], [-1.2, 2.2], [1.1, 2.2], [3.5, 2.2],
    ],
    torches: [[-2.4, -1.2], [-2.4, 1.2], [2.5, -1.5]],
  },
  "ruins-sanctum": {
    kind: POI_RUINS, radiusX: 6, radiusY: 5, chestOffset: [0, 0],
    guards: ["skeleton", "skeleton", "skeleton", "skeleton", "skeleton", "golem", "golem"], mask: "sanctum",
    fences: [], tents: [], campfires: [],
    pillars: [
      [-2.6, -4.2], [2.6, -4.2], [-4.8, -2.2], [4.8, -2.2],
      [-4.8, 2.2], [4.8, 2.2], [-2.6, 4.2], [2.6, 4.2], [-2.0, -2.0], [2.0, 2.0],
    ],
    torches: [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]],
  },
};

export function getPoiGuardRoster(layout: PoiLayoutKind): readonly PoiGuardKind[] {
  const frontier = getFrontierPoiSpec(layout);
  if (frontier) return frontier.guards;
  return POI_LAYOUTS[layout]?.guards ?? [];
}

const MASK_TESTERS: Readonly<Record<PoiLayoutSpec["mask"], (q: {
  readonly dx: number; readonly dy: number; readonly ax: number; readonly ay: number; readonly rx: number; readonly ry: number;
}) => boolean>> = {
  "l-shape": (q) => !(q.dx > 1 && q.dy < -1),
  oct: (q) => q.ax + q.ay <= q.rx + q.ry - 1,
  cross: (q) => q.ax <= 1 || q.ay <= 1 || (q.ax <= 2 && q.ay <= 2),
  sanctum: (q) => q.ax <= 3 || q.ay <= 2,
  courtyard: (q) => (q.ax * q.ax) / (q.rx * q.rx + 0.5) + (q.ay * q.ay) / (q.ry * q.ry + 0.5) <= 1.25,
};

export function isInsidePoiLayoutMask(poi: ChunkPoi, wx: number, wy: number): boolean {
  const frontier = getFrontierPoiSpec(poi.layout);
  if (frontier) return isInsideFrontierPoiMask(poi, wx, wy);
  const spec = POI_LAYOUTS[poi.layout];
  if (!spec) return false;
  const dx = wx - Math.floor(poi.centerX);
  const dy = wy - Math.floor(poi.centerY);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax > poi.radiusX || ay > poi.radiusY) return false;
  return MASK_TESTERS[spec.mask]({ dx, dy, ax, ay, rx: poi.radiusX, ry: poi.radiusY });
}

export function layoutFloorGround(poi: ChunkPoi, wx: number, wy: number): GroundKind {
  const frontier = getFrontierPoiSpec(poi.layout);
  if (frontier) return frontierPoiFloorGround(frontier);
  const ax = Math.abs(wx - Math.floor(poi.centerX));
  const ay = Math.abs(wy - Math.floor(poi.centerY));
  if (poi.kind === POI_BANDIT) {
    return ax <= poi.radiusX - 1 && ay <= poi.radiusY - 1 ? GroundKind.DirtPath : GroundKind.ForestFloor;
  }
  return ax <= Math.max(1, poi.radiusX - 2) && ay <= Math.max(1, poi.radiusY - 1) ? GroundKind.CliffStone : GroundKind.MossStone;
}

function makeProp(opts: {
  readonly kind: PropKind; readonly x: number; readonly y: number;
  readonly elevation: number; readonly radius: number; readonly blocks: boolean;
}): ChunkProp {
  return {
    id: `poi-${opts.kind}:${Math.round(opts.x * 10)},${Math.round(opts.y * 10)}`,
    kind: opts.kind, x: opts.x, y: opts.y, variant: 0,
    elevation: opts.elevation, radius: opts.radius, blocksMovement: opts.blocks,
  };
}

export function stampPoiLayoutPropsAndLights(opts: {
  readonly poi: ChunkPoi; readonly props: ChunkProp[]; readonly lights: PointLightSpec[];
}): void {
  const { poi, props, lights } = opts;
  const frontier = getFrontierPoiSpec(poi.layout);
  if (frontier) { stampFrontierPoiProps({ poi, spec: frontier, props, lights }); return; }
  const spec = POI_LAYOUTS[poi.layout];
  if (!spec) return;
  const { centerX: cx, centerY: cy, elevation } = poi;
  for (const [dx, dy] of spec.fences) {
    props.push(makeProp({ kind: PropKind.Palisade, x: cx + dx, y: cy + dy, elevation, radius: 0.5, blocks: true }));
  }
  for (const [dx, dy] of spec.tents) {
    props.push(makeProp({ kind: PropKind.Tent, x: cx + dx, y: cy + dy, elevation, radius: 0.55, blocks: true }));
  }
  for (const [dx, dy] of spec.pillars) {
    props.push(makeProp({ kind: PropKind.RuinPillar, x: cx + dx, y: cy + dy, elevation, radius: 0.4, blocks: true }));
  }
  spec.campfires.forEach(([dx, dy], i) => {
    props.push(makeProp({ kind: PropKind.Campfire, x: cx + dx, y: cy + dy, elevation, radius: 0.78, blocks: true }));
    lights.push({ id: `${poi.id}-fire-${i}`, kind: "campfire", x: cx + dx, y: cy + dy, color: CAMPFIRE_COLOR, radiusPx: 230, intensity: 1.25 });
  });
  spec.torches.forEach(([dx, dy], i) => {
    props.push(makeProp({ kind: PropKind.Torch, x: cx + dx, y: cy + dy, elevation, radius: 0.2, blocks: false }));
    lights.push({ id: `${poi.id}-torch-${i}`, kind: "torch", x: cx + dx, y: cy + dy, color: TORCH_COLOR, radiusPx: 135, intensity: 0.88 });
  });
}
