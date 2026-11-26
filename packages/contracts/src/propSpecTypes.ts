/** Shared declarative specification interface for all world and camp props. */
import type { HarvestNodeSpec } from "./items.js";
import type { PropKind } from "./world.js";

export type PropCategory =
  | "tree"
  | "foliage"
  | "rock"
  | "ore"
  | "structure"
  | "lighting"
  | "furniture"
  | "hazard"
  | "portal";

export type PropCombatSurface = "none" | "wood" | "stone" | "flesh" | "metal";
export type PropInteractionKind =
  | "chest"
  | "workbench"
  | "forge"
  | "campfire"
  | "bedroll"
  | "portal"
  | "lore"
  | "puzzle"
  | "shrine";

export interface PropCollisionSpec {
  readonly shape: "none" | "circle" | "aabb";
  readonly offsetY: number;
  readonly radius?: number | undefined;
  readonly halfX?: number | undefined;
  readonly halfY?: number | undefined;
}

export interface PropFoliageOcclusionSpec {
  readonly radius: number;
  readonly weight: number;
}

export interface PropStealthSpec {
  readonly groundCoverBonus: number;
  readonly canopyShadeBonus: number;
  readonly lightMaxRadius?: number | undefined;
  readonly lightIntensity?: number | undefined;
}

export interface PropSpec {
  readonly kind: PropKind;
  readonly category: PropCategory;
  readonly collision: PropCollisionSpec;
  readonly blocksLineOfSight: boolean;
  readonly foliageOcclusion?: PropFoliageOcclusionSpec | undefined;
  readonly stealth: PropStealthSpec;
  readonly combatSurface: PropCombatSurface;
  readonly isTreeTrunk?: boolean | undefined;
  readonly spiderWebAnchor: boolean;
  readonly harvest?: HarvestNodeSpec | undefined;
  readonly interactionKind?: PropInteractionKind | undefined;
}
