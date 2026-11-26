/** Lookup, floor grounding, mask check, and prop/brazier stamping for the 18 frontier POI kinds. */
import { GroundKind, PropKind, type ChunkPoi, type ChunkProp, type PoiLayoutKind, type PointLightSpec } from "../types.js";
import { LAIR_AND_PUZZLE_LAYOUTS } from "./lairAndPuzzleLayouts.js";
import { MICRO_SCENE_LAYOUTS } from "./microLayouts.js";
import { SHRINE_AND_FRIENDLY_LAYOUTS, type FrontierPoiLayoutSpec } from "./shrineLayouts.js";

const FRONTIER_POI_LAYOUTS: Readonly<Record<string, FrontierPoiLayoutSpec>> = {
  ...SHRINE_AND_FRIENDLY_LAYOUTS,
  ...MICRO_SCENE_LAYOUTS,
  ...LAIR_AND_PUZZLE_LAYOUTS,
};

export function getFrontierPoiSpec(layout: PoiLayoutKind): FrontierPoiLayoutSpec | undefined {
  return FRONTIER_POI_LAYOUTS[layout];
}

export function isInsideFrontierPoiMask(poi: ChunkPoi, wx: number, wy: number): boolean {
  const dx = Math.abs(wx - Math.floor(poi.centerX));
  const dy = Math.abs(wy - Math.floor(poi.centerY));
  return dx * dx / (poi.radiusX * poi.radiusX + 0.4) + dy * dy / (poi.radiusY * poi.radiusY + 0.4) <= 1.2;
}

const FLOOR_BY_THEME: Readonly<Record<FrontierPoiLayoutSpec["floor"], GroundKind>> = {
  stone: GroundKind.CliffStone,
  dirt: GroundKind.DirtPath,
  moss: GroundKind.MossStone,
  cursed: GroundKind.RuinFlagstone,
};

export function frontierPoiFloorGround(spec: FrontierPoiLayoutSpec): GroundKind {
  return FLOOR_BY_THEME[spec.floor];
}

function brazierIdForPoi(poiId: string, idx: number): string {
  return `brazier:${poiId}:${idx}`;
}

export function computeBrazierPositions(opts: {
  readonly poiId: string; readonly layout: PoiLayoutKind; readonly centerX: number; readonly centerY: number;
}): readonly { readonly id: string; readonly x: number; readonly y: number }[] | undefined {
  const spec = FRONTIER_POI_LAYOUTS[opts.layout];
  if (!spec?.braziers?.length) return undefined;
  return spec.braziers.map(([dx, dy], i) => ({
    id: brazierIdForPoi(opts.poiId, i),
    x: opts.centerX + dx,
    y: opts.centerY + dy,
  }));
}

export function stampFrontierPoiProps(opts: {
  readonly poi: ChunkPoi;
  readonly spec: FrontierPoiLayoutSpec;
  readonly props: ChunkProp[];
  readonly lights: PointLightSpec[];
}): void {
  const { poi, spec, props, lights } = opts;
  spec.props.forEach((p, idx) => {
    const x = poi.centerX + p.dx;
    const y = poi.centerY + p.dy;
    props.push({
      id: `poi-${p.kind}:${Math.round(x * 10)},${Math.round(y * 10)}`,
      kind: p.kind, x, y, variant: 0, elevation: poi.elevation, radius: p.radius, blocksMovement: p.blocks,
    });
    if (p.light) lights.push({ id: `${poi.id}-l-${idx}`, x, y, ...p.light });
  });
  (poi.brazierPositions ?? []).forEach((b) => {
    props.push({
      id: b.id, kind: PropKind.BrazierUnlit, x: b.x, y: b.y, variant: 0, elevation: poi.elevation, radius: 0.36, blocksMovement: true,
    });
  });
}
