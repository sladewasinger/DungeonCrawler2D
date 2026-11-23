/** Shared crisp solid sel-out outline thickness presets (texels @ 48 px/tile, zero AA feather). */

export type OutlineStyleId = "subtle" | "borderlands" | "bold";

export interface OutlineStyleSpec {
  readonly id: OutlineStyleId;
  /** Solid ink outline radius (texels @ 48 px/tile) on Hero, Creatures & Held Gear. */
  readonly actorSolidPx: number;
  /** Solid ink outline radius (texels @ 48 px/tile) on Trees, Bushes, Boulders & POIs. */
  readonly propSolidPx: number;
  /** Solid ink outline radius (texels @ 48 px/tile) on Tall Grass & Wildflowers. */
  readonly foliageSolidPx: number;
}

export const OUTLINE_STYLE_PRESETS: Readonly<Record<OutlineStyleId, OutlineStyleSpec>> = {
  subtle: { id: "subtle", actorSolidPx: 1.0, propSolidPx: 1.0, foliageSolidPx: 1.0 },
  borderlands: { id: "borderlands", actorSolidPx: 2.0, propSolidPx: 1.3, foliageSolidPx: 1.0 },
  bold: { id: "bold", actorSolidPx: 2.0, propSolidPx: 2.0, foliageSolidPx: 0 },
};

export const DEFAULT_OUTLINE_STYLE: OutlineStyleId = "bold";
export const ACTIVE_OUTLINE_STYLE: OutlineStyleSpec = OUTLINE_STYLE_PRESETS[DEFAULT_OUTLINE_STYLE];
