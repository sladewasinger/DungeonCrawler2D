// Authored per-tile stack shape (Austin's reskin decree: "no more z buttons, just
// floor varieties, height, stairs") and the door/interactable feature vocabulary a
// stack tile can carry, plus the two editor-map JSON versions this contract bridges.

import { TILE, type TileType } from "../types.js";

/** Climb-direction convention matches world/stairs.ts's DIRS: 0=N, 1=E, 2=S, 3=W. */
export type StackDir = 0 | 1 | 2 | 3;

/** Door/interactable overlays — every non-Floor/Wall/Stairs TileType the generator stamps. */
export const STACK_FEATURE = {
  DoorPersonal: "doorPersonal",
  DoorParty: "doorParty",
  DoorExit: "doorExit",
  CraftingTable: "craftingTable",
  Stash: "stash",
  DoorSafeRoom: "doorSafeRoom",
} as const;
export type StackFeature = (typeof STACK_FEATURE)[keyof typeof STACK_FEATURE];

/** StackFeature -> the TileType it compiles to. */
export const FEATURE_TILE: Readonly<Record<StackFeature, TileType>> = {
  [STACK_FEATURE.DoorPersonal]: TILE.DoorPersonal,
  [STACK_FEATURE.DoorParty]: TILE.DoorParty,
  [STACK_FEATURE.DoorExit]: TILE.DoorExit,
  [STACK_FEATURE.CraftingTable]: TILE.CraftingTable,
  [STACK_FEATURE.Stash]: TILE.Stash,
  [STACK_FEATURE.DoorSafeRoom]: TILE.DoorSafeRoom,
};

/** The reverse of FEATURE_TILE, keyed by the raw TileType number. */
export const TILE_FEATURE: ReadonlyMap<TileType, StackFeature> = new Map(
  (Object.entries(FEATURE_TILE) as [StackFeature, TileType][]).map(([feature, tile]) => [tile, feature]),
);

/**
 * One authored tile. `height` is the finite floor elevation — non-negative by
 * construction in the editor's paint-over UI, but a plain `number` here
 * (not narrowed) because worldgen's mechanical (tiles,height)->stacks conversion
 * (fromHeightField.ts) must round-trip a generated pit/chasm floor (height < 0),
 * or a raised boundary sunk to height <= 0 by a neighboring pit, through this exact
 * same field rather than inventing a second one. `cap` ALONE decides
 * walkability: any non-null floor-variant id makes the tile a walkable Floor
 * at height `height`; null makes it an empty Void at height `height`, regardless
 * of `height`'s sign (see compile.ts's compileBase doc comment — the editor's
 * "nothing painted here" ground state is height=0 WITH a default cap; capless
 * state is reserved for intentionally empty cells. `feature` overrides
 * the compiled TileType entirely (a door/table/stash on that floor).
 *
 * `stair.dir` orients the climb (which neighbor the author intends as the
 * higher side). `stair.height` is an optional exact override: when present
 * (always true of worldgen's mechanical conversion, which already knows the
 * real height and must reproduce it
 * byte-for-byte — see compile.ts's doc comment on why a generic formula
 * can't always re-derive it), compile uses it verbatim. When absent —
 * freshly authored in the editor via paintStairsAt, which has no height to
 * give — compile interpolates a run between the tile's flanking non-stair
 * anchors along `dir`, so "the engine figures out what height it is at"
 * per Austin's decree. docs/R2-STAIRS-SPEC.md's compact-stairs contract:
 * a deliberate run spans exactly one z-unit per tile (anchors differing by
 * `stepCount`), and each tread's compiled height is its tile-CENTER value
 * `low + delta*(k-0.5)/stepCount` — not an even split of the full rise
 * across `stepCount + 1` gaps. The continuous ramp a moving body actually
 * stands on (world/stairs.ts's stairRampAt) is independent of this
 * compiled scalar; the two only need to agree at tile center.
 */
export interface StackTile {
  readonly height: number;
  readonly cap: string | null;
  readonly stair: { readonly dir: StackDir; readonly height?: number | undefined } | null;
  readonly feature?: StackFeature | undefined;
}

/** Compiled per-tile output: exactly what World/Chunk already consumes. */
export interface CompiledField {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
}

/** Editor-authored torch overlay position — additive, not height/tile-affecting. */
export interface TorchTile {
  readonly wx: number;
  readonly wy: number;
}

/** Current editor-map JSON: explicit stacks are the sole persisted representation. */
export interface EditorMapV2 {
  readonly version: 2;
  readonly width: number;
  readonly rows: number;
  readonly stacks: readonly StackTile[];
  readonly torches?: readonly TorchTile[] | undefined;
}

/** Mechanical worldgen conversion has no real art catalog to consult — see fromHeightField.ts's doc comment. */
export const DEFAULT_FLOOR_CAP = "floor";
