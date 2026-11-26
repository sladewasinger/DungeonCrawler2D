/** Shared crisp solid sel-out outline thickness config (texels @ 48 px/tile, zero AA feather). */

export interface OutlineStyleSpec {
  readonly id: "bold";
  /** Solid ink outline radius (texels @ 48 px/tile) on Hero, Creatures & Held Gear. */
  readonly actorSolidPx: number;
  /** Solid ink outline radius (texels @ 48 px/tile) on Trees, Bushes, Boulders & POIs. */
  readonly propSolidPx: number;
  /** Solid ink outline radius (texels @ 48 px/tile) on Tall Grass & Wildflowers. */
  readonly foliageSolidPx: number;
}

export const ACTIVE_OUTLINE_STYLE: OutlineStyleSpec = {
  id: "bold",
  actorSolidPx: 2.0,
  propSolidPx: 2.0,
  foliageSolidPx: 0,
};
